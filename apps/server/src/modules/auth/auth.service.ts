import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { UsersService } from '../users/users.service';
import { SessionService } from '../session/session.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService
  ) {}

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

    const session = await this.sessionService.create(user);
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

    response.cookie(this.sessionService.getCookieName(), session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/'
    });

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
}
