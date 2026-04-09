import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { UsersService } from '../users/users.service';
import { SessionService } from '../session/session.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService
  ) {}

  login(loginName: string, password: string, response: Response) {
    const user = this.usersService.validateLocalDebugUser(loginName, password);
    if (!user) {
      throw new UnauthorizedException('invalid login credentials');
    }

    const session = this.sessionService.create(user);
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

  getCurrentUser(request: Request) {
    const sessionId = this.readSessionId(request);
    const session = this.sessionService.get(sessionId);
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

  logout(request: Request, response: Response) {
    const sessionId = this.readSessionId(request);
    this.sessionService.delete(sessionId);
    response.clearCookie(this.sessionService.getCookieName(), {
      path: '/'
    });
    return {
      ok: true
    };
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
