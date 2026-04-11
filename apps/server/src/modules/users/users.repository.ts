import { AuthRoleAssignment, AuthUser } from '../../shared/types/auth-user';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export type LocalLoginAccount = AuthUser & {
  passwordHash: string;
  localLoginEnabled: boolean;
  isActive: boolean;
};

export type NormalizedUserRole = AuthRoleAssignment;

export interface UsersRepository {
  findByLocalLogin(loginName: string): Promise<LocalLoginAccount | null>;
  findById(id: string): Promise<AuthUser | null>;
  touchLocalLoginSuccess(userId: string): Promise<void>;
}
