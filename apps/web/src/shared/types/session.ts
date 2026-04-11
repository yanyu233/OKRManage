export type UserRole = 'system-admin' | 'section-leader' | 'group-leader' | 'employee';

export type SessionRoleAssignment = {
  role: UserRole;
  isPrimary: boolean;
};

export type SessionUser = {
  id: string;
  name: string;
  role: UserRole;
  activeRole: UserRole;
  roles: SessionRoleAssignment[];
  loginName: string;
};

export type SessionResponse = {
  authenticated: boolean;
  user: SessionUser | null;
};
