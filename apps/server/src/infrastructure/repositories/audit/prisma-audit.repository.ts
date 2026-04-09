import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditEntry, AuditRepository } from './audit.repository';

@Injectable()
export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async write(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        actorRoleCode: entry.actorRoleCode ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        beforeJson: entry.beforeJson === undefined ? undefined : (entry.beforeJson as object),
        afterJson: entry.afterJson === undefined ? undefined : (entry.afterJson as object),
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null
      }
    });
  }
}
