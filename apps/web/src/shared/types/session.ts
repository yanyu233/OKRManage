export type UserRole = 'system-admin' | 'section-leader' | 'group-leader' | 'employee';

export type SessionUser = {
  id: string;
  name: string;
  role: UserRole;
  loginName: string;
};

export type SessionResponse = {
  authenticated: boolean;
  user: SessionUser | null;
};
