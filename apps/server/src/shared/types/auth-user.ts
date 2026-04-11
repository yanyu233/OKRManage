export type AuthRoleAssignment = {
  role: string;
  isPrimary: boolean;
};

export interface AuthUser {
  id: string;
  name: string;
  role: string;
  activeRole: string;
  roles: AuthRoleAssignment[];
  loginName: string;
}
