import { AuthUser } from '../../../shared/types/auth-user';

export const SESSIONS_REPOSITORY = Symbol('SESSIONS_REPOSITORY');

export type SessionRecord = {
  id: string;
  user: AuthUser;
  expiresAt: Date;
};

export interface SessionsRepository {
  create(user: AuthUser, authMethod: string, ttlMinutes: number): Promise<SessionRecord>;
  get(sessionId: string | null): Promise<SessionRecord | null>;
  switchActiveRole(sessionId: string | null, role: string): Promise<SessionRecord>;
  delete(sessionId: string | null): Promise<void>;
}
