import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_REPOSITORY, AuditEntry, AuditRepository } from '../../infrastructure/repositories/audit/audit.repository';

@Injectable()
export class AuditService {
  constructor(@Inject(AUDIT_REPOSITORY) private readonly auditRepository: AuditRepository) {}

  write(entry: AuditEntry): Promise<void> {
    return this.auditRepository.write(entry);
  }
}
