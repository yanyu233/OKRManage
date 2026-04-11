import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthRoleAssignment, AuthUser } from '../../../shared/types/auth-user';
import { LocalLoginAccount, UsersRepository, WecomMappedUser } from '../../../modules/users/users.repository';

const ROLE_PRIORITY = ['system-admin', 'section-leader', 'group-leader', 'employee'];

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByLocalLogin(loginName: string): Promise<LocalLoginAccount | null> {
    const normalized = loginName.trim().toLowerCase();
    const account = await this.prisma.localAccount.findFirst({
      where: {
        loginName: normalized
      },
      include: {
        user: {
          include: {
            roleAssignments: {
              where: {
                isEnabled: true
              }
            }
          }
        }
      }
    });

    if (!account) {
      return null;
    }

    const authUser = this.toAuthUser(account.user, account.loginName);
    if (!authUser) {
      return null;
    }

    return {
      ...authUser,
      passwordHash: account.passwordHash,
      localLoginEnabled: account.localLoginEnabled,
      isActive: account.user.isActive
    };
  }

  async findById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        localAccount: true,
        roleAssignments: {
          where: {
            isEnabled: true
          }
        }
      }
    });

    if (!user) {
      return null;
    }

    return this.toAuthUser(user, user.localAccount?.loginName ?? user.wecomUserId ?? user.employeeNo ?? user.id);
  }

  async findByWecomUserId(wecomUserId: string): Promise<WecomMappedUser | null> {
    const normalized = wecomUserId.trim();
    if (normalized.length === 0) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { wecomUserId: normalized },
      include: {
        localAccount: true,
        roleAssignments: {
          where: {
            isEnabled: true
          }
        }
      }
    });

    if (!user || !user.wecomUserId) {
      return null;
    }

    const authUser = this.toAuthUser(user, user.localAccount?.loginName ?? user.wecomUserId ?? user.employeeNo ?? user.id);
    if (!authUser) {
      return null;
    }

    return {
      ...authUser,
      wecomUserId: user.wecomUserId,
      isActive: user.isActive
    };
  }

  async touchLocalLoginSuccess(userId: string): Promise<void> {
    await this.prisma.localAccount.update({
      where: { userId },
      data: {
        lastLoginAt: new Date()
      }
    });
  }

  private toAuthUser(
    user: {
      id: string;
      name: string;
      roleAssignments: Array<{ roleCode: string; isPrimary: boolean }>;
    },
    loginName: string
  ): AuthUser | null {
    const roles = normalizeRoles(user.roleAssignments);
    const activeRole = resolveActiveRole(roles);

    if (!activeRole) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      role: activeRole,
      activeRole,
      roles,
      loginName
    };
  }
}

function normalizeRoles(assignments: Array<{ roleCode: string; isPrimary: boolean }>): AuthRoleAssignment[] {
  const byRole = new Map<string, AuthRoleAssignment>();

  for (const assignment of assignments) {
    const current = byRole.get(assignment.roleCode);
    if (!current) {
      byRole.set(assignment.roleCode, {
        role: assignment.roleCode,
        isPrimary: assignment.isPrimary
      });
      continue;
    }

    if (assignment.isPrimary && !current.isPrimary) {
      byRole.set(assignment.roleCode, {
        role: assignment.roleCode,
        isPrimary: true
      });
    }
  }

  return Array.from(byRole.values()).sort((left, right) => {
    const leftPriority = ROLE_PRIORITY.indexOf(left.role);
    const rightPriority = ROLE_PRIORITY.indexOf(right.role);
    return normalizePriority(leftPriority) - normalizePriority(rightPriority);
  });
}

function resolveActiveRole(roles: AuthRoleAssignment[]): string | null {
  const primaryRole = roles.find((role) => role.isPrimary);
  if (primaryRole) {
    return primaryRole.role;
  }

  return roles[0]?.role ?? null;
}

function normalizePriority(index: number) {
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
