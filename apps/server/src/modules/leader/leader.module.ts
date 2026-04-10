import { Module } from '@nestjs/common';
import { PrismaLeaderRepository } from '../../infrastructure/repositories/leader/prisma-leader.repository';
import { LEADER_REPOSITORY } from '../../infrastructure/repositories/leader/leader.repository';
import { AuditModule } from '../audit/audit.module';
import { SessionModule } from '../session/session.module';
import { LeaderController } from './leader.controller';
import { LeaderService } from './leader.service';

@Module({
  imports: [SessionModule, AuditModule],
  controllers: [LeaderController],
  providers: [
    LeaderService,
    PrismaLeaderRepository,
    {
      provide: LEADER_REPOSITORY,
      useExisting: PrismaLeaderRepository
    }
  ]
})
export class LeaderModule {}
