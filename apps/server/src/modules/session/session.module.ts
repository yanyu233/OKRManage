import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { PrismaSessionsRepository } from '../../infrastructure/repositories/sessions/prisma-sessions.repository';
import { SESSIONS_REPOSITORY } from '../../infrastructure/repositories/sessions/sessions.repository';

@Module({
  providers: [
    SessionService,
    PrismaSessionsRepository,
    {
      provide: SESSIONS_REPOSITORY,
      useExisting: PrismaSessionsRepository
    }
  ],
  exports: [SessionService]
})
export class SessionModule {}
