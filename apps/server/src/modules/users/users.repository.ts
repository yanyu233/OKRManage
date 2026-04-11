import { AuthRoleAssignment, AuthUser } from '../../shared/types/auth-user';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export type LocalLoginAccount = AuthUser & {
  passwordHash: string;
  localLoginEnabled: boolean;
  isActive: boolean;
};

export type WecomMappedUser = AuthUser & {
  wecomUserId: string;
  isActive: boolean;
};

export type NormalizedUserRole = AuthRoleAssignment;

export interface UsersRepository {
  findByLocalLogin(loginName: string): Promise<LocalLoginAccount | null>;
  findById(id: string): Promise<AuthUser | null>;
  findByWecomUserId(wecomUserId: string): Promise<WecomMappedUser | null>;
  touchLocalLoginSuccess(userId: string): Promise<void>;
}
