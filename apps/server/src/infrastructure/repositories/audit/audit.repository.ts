export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export type AuditEntry = {
  actorUserId?: string | null;
  actorRoleCode?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

export interface AuditRepository {
  write(entry: AuditEntry): Promise<void>;
}
