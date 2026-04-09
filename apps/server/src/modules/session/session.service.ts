import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthUser } from '../../shared/types/auth-user';
import { RuntimeConfigService } from '../config/runtime-config.service';

interface SessionRecord {
  id: string;
  user: AuthUser;
  expiresAt: number;
}

@Injectable()
export class SessionService {
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(private readonly runtimeConfig: RuntimeConfigService) {}

  create(user: AuthUser) {
    const id = randomUUID();
    const expiresAt = Date.now() + this.runtimeConfig.sessionTtlMinutes * 60 * 1000;
    this.sessions.set(id, { id, user, expiresAt });
    return { id, user, expiresAt };
  }

  get(sessionId: string | undefined | null) {
    if (!sessionId) return null;
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  delete(sessionId: string | undefined | null) {
    if (!sessionId) return;
    this.sessions.delete(sessionId);
  }

  getCookieName() {
    return this.runtimeConfig.sessionCookieName;
  }
}
