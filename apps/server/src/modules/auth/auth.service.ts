import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { UsersService } from '../users/users.service';
import { SessionService } from '../session/session.service';
import { AuditService } from '../audit/audit.service';
import { AuthStartResponseDto } from './dto/auth-start-response.dto';
import { WecomCallbackQueryDto } from './dto/wecom-callback-query.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly runtimeConfig: RuntimeConfigService,
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService
  ) {}

  async start(request: Request): Promise<AuthStartResponseDto> {
    const returnTo = this.readReturnTo(request);
    const sessionId = this.readSessionId(request);
    const session = await this.sessionService.get(sessionId);

    if (session) {
      return {
        action: 'session',
        redirectTo: returnTo || '/'
      };
    }

    if (this.runtimeConfig.authMode === 'local-debug') {
      return {
        action: 'manual-login',
        redirectTo: this.buildLoginRedirect(returnTo)
      };
    }

    return {
      action: 'wecom',
      redirectTo: this.buildWecomStartRedirect(returnTo)
    };
  }

  wecomStart(request: Request, response: Response) {
    const returnTo = this.readReturnTo(request);
    const location = this.buildWecomAuthorizeUrl(returnTo);
    return response.redirect(location);
  }

  async wecomCallback(query: WecomCallbackQueryDto, request: Request, response: Response) {
    const returnTo = this.readStateReturnTo(query.state);

    try {
      const wecomUserId = await this.resolveWecomUserId(query.code);
      const user = await this.usersService.findByWecomUserId(wecomUserId);

      if (!user) {
        await this.auditService.write({
          action: 'auth.wecom.login.unmapped',
          entityType: 'auth',
          entityId: wecomUserId,
          afterJson: {
            wecomUserId,
            returnTo
          },
          ip: request.ip,
          userAgent: request.get('user-agent') ?? null
        });

        return response.redirect(this.buildFrontendLoginRedirect(returnTo, 'unmapped'));
      }

      if (!user.isActive) {
        await this.auditService.write({
          actorUserId: user.id,
          actorRoleCode: user.role,
          action: 'auth.wecom.login.failure',
          entityType: 'auth',
          entityId: user.id,
          afterJson: {
            reason: 'inactive-user',
            wecomUserId
          },
          ip: request.ip,
          userAgent: request.get('user-agent') ?? null
        });

        return response.redirect(this.buildFrontendUrl('/unauthorized'));
      }

      const session = await this.sessionService.create(user, 'wecom');
      await this.auditService.write({
        actorUserId: user.id,
        actorRoleCode: user.role,
        action: 'auth.wecom.login.success',
        entityType: 'session',
        entityId: session.id,
        afterJson: {
          authMethod: 'wecom',
          wecomUserId,
          returnTo
        },
        ip: request.ip,
        userAgent: request.get('user-agent') ?? null
      });

      this.writeSessionCookie(response, session.id);
      return response.redirect(this.buildFrontendUrl(returnTo || '/'));
    } catch (error) {
      await this.auditService.write({
        action: 'auth.wecom.login.failure',
        entityType: 'auth',
        entityId: query.code,
        afterJson: {
          reason: error instanceof Error ? error.message : 'unknown-error'
        },
        ip: request.ip,
        userAgent: request.get('user-agent') ?? null
      });
      throw error;
    }
  }

  async login(loginName: string, password: string, response: Response) {
    const user = await this.usersService.validateLocalDebugUser(loginName, password);
    if (!user) {
      await this.auditService.write({
        action: 'auth.manual-login.failure',
        entityType: 'auth',
        entityId: loginName,
        afterJson: { loginName }
      });
      throw new UnauthorizedException('invalid login credentials');
    }

    const session = await this.sessionService.create(user, 'manual-login');
    await this.auditService.write({
      actorUserId: user.id,
      actorRoleCode: user.role,
      action: 'auth.manual-login.success',
      entityType: 'session',
      entityId: session.id,
      afterJson: {
        loginName: user.loginName,
        authMethod: 'manual-login'
      }
    });

    this.writeSessionCookie(response, session.id);

    return {
      ok: true,
      user
    };
  }

  async getCurrentUser(request: Request) {
    const sessionId = this.readSessionId(request);
    const session = await this.sessionService.get(sessionId);
    if (!session) {
      return {
        authenticated: false,
        user: null
      };
    }

    return {
      authenticated: true,
      user: session.user
    };
  }

  async logout(request: Request, response: Response) {
    const sessionId = this.readSessionId(request);
    const session = await this.sessionService.get(sessionId);
    await this.sessionService.delete(sessionId);
    await this.auditService.write({
      actorUserId: session?.user.id ?? null,
      actorRoleCode: session?.user.role ?? null,
      action: 'auth.logout',
      entityType: 'session',
      entityId: sessionId,
      beforeJson: session
        ? {
            loginName: session.user.loginName
          }
        : undefined
    });
    response.clearCookie(this.sessionService.getCookieName(), {
      path: '/'
    });
    return {
      ok: true
    };
  }

  async switchActiveRole(request: Request, role: string) {
    const sessionId = this.readSessionId(request);
    const previous = await this.sessionService.get(sessionId);
    if (!previous) {
      throw new UnauthorizedException('authentication required');
    }

    try {
      const session = await this.sessionService.switchActiveRole(sessionId, role);
      await this.auditService.write({
        actorUserId: session.user.id,
        actorRoleCode: session.user.role,
        action: 'auth.active-role.switch',
        entityType: 'session',
        entityId: session.id,
        beforeJson: {
          activeRole: previous.user.role
        },
        afterJson: {
          activeRole: session.user.role
        }
      });

      return {
        ok: true,
        user: session.user
      };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw error;
    }
  }

  private readSessionId(request: Request) {
    const cookieHeader = request.headers.cookie || '';
    const target = `${this.sessionService.getCookieName()}=`;
    const value = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(target));

    return value ? value.slice(target.length) : null;
  }

  private readReturnTo(request: Request): string | null {
    const rawValue = request.query.returnTo;
    if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
      return null;
    }

    return this.normalizeReturnTo(rawValue);
  }

  private buildLoginRedirect(returnTo: string | null) {
    if (!returnTo) {
      return '/login';
    }

    return `/login?returnTo=${encodeURIComponent(returnTo)}`;
  }

  private buildWecomStartRedirect(returnTo: string | null) {
    if (!returnTo) {
      return '/api/auth/wecom/start';
    }

    return `/api/auth/wecom/start?returnTo=${encodeURIComponent(returnTo)}`;
  }

  private buildWecomAuthorizeUrl(returnTo: string | null) {
    if (!this.runtimeConfig.isWecomConfigured) {
      throw new ServiceUnavailableException('WeCom configuration is incomplete');
    }

    const params = new URLSearchParams({
      appid: this.runtimeConfig.wecomCorpId!,
      redirect_uri: this.runtimeConfig.wecomRedirectUri!,
      response_type: 'code',
      scope: 'snsapi_base',
      agentid: this.runtimeConfig.wecomAgentId!,
      state: returnTo || '/'
    });

    return `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`;
  }

  private readStateReturnTo(rawState?: string | null) {
    if (!rawState) {
      return '/';
    }

    return this.normalizeReturnTo(rawState) ?? '/';
  }

  private normalizeReturnTo(rawValue: string | null | undefined) {
    if (!rawValue) {
      return null;
    }

    const value = rawValue.trim();
    if (!value.startsWith('/') || value.startsWith('//')) {
      return null;
    }

    return value;
  }

  private async resolveWecomUserId(code: string) {
    const normalized = code.trim();
    const mockPrefix = 'mock:';
    if (normalized.startsWith(mockPrefix)) {
      const value = normalized.slice(mockPrefix.length).trim();
      if (!value) {
        throw new UnauthorizedException('invalid mock WeCom callback code');
      }

      return value;
    }

    throw new UnauthorizedException('real WeCom code exchange is not configured');
  }

  private buildFrontendLoginRedirect(returnTo: string | null, reason: string) {
    const url = new URL('/login', this.runtimeConfig.webBaseUrl);
    url.searchParams.set('reason', reason);
    if (returnTo) {
      url.searchParams.set('returnTo', returnTo);
    }

    return url.toString();
  }

  private buildFrontendUrl(path: string) {
    const safePath = this.normalizeReturnTo(path) ?? '/';
    return new URL(safePath, this.runtimeConfig.webBaseUrl).toString();
  }

  private writeSessionCookie(response: Response, sessionId: string) {
    response.cookie(this.sessionService.getCookieName(), sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/'
    });
  }
}
