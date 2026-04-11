import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../shared/types/auth-user';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { Inject } from '@nestjs/common';
import { SESSIONS_REPOSITORY, SessionsRepository } from '../../infrastructure/repositories/sessions/sessions.repository';

@Injectable()
export class SessionService {
  constructor(
    private readonly runtimeConfig: RuntimeConfigService,
    @Inject(SESSIONS_REPOSITORY) private readonly sessionsRepository: SessionsRepository
  ) {}

  create(user: AuthUser, authMethod = 'manual-login') {
    return this.sessionsRepository.create(user, authMethod, this.runtimeConfig.sessionTtlMinutes);
  }

  async get(sessionId: string | undefined | null) {
    const session = await this.sessionsRepository.get(sessionId ?? null);
    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.sessionsRepository.delete(sessionId ?? null);
      return null;
    }

    return session;
  }

  switchActiveRole(sessionId: string | undefined | null, role: string) {
    return this.sessionsRepository.switchActiveRole(sessionId ?? null, role);
  }

  delete(sessionId: string | undefined | null) {
    return this.sessionsRepository.delete(sessionId ?? null);
  }

  getCookieName() {
    return this.runtimeConfig.sessionCookieName;
  }
}
