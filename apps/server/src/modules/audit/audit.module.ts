import { Module } from '@nestjs/common';
import { PrismaAuditRepository } from '../../infrastructure/repositories/audit/prisma-audit.repository';
import { AUDIT_REPOSITORY } from '../../infrastructure/repositories/audit/audit.repository';
import { AuditService } from './audit.service';

@Module({
  providers: [
    AuditService,
    PrismaAuditRepository,
    {
      provide: AUDIT_REPOSITORY,
      useExisting: PrismaAuditRepository
    }
  ],
  exports: [AuditService]
})
export class AuditModule {}
