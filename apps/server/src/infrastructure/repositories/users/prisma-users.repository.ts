import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../../shared/types/auth-user';
import { LocalLoginAccount, UsersRepository } from '../../../modules/users/users.repository';

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
                isPrimary: true,
                isEnabled: true
              },
              take: 1
            }
          }
        }
      }
    });

    if (!account) {
      return null;
    }

    const primaryRole = account.user.roleAssignments[0];
    if (!primaryRole) {
      return null;
    }

    return {
      id: account.user.id,
      name: account.user.name,
      role: primaryRole.roleCode,
      loginName: account.loginName,
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
            isPrimary: true,
            isEnabled: true
          },
          take: 1
        }
      }
    });

    if (!user || !user.localAccount) {
      return null;
    }

    const primaryRole = user.roleAssignments[0];
    if (!primaryRole) {
      return null;
    }

    return this.toAuthUser(user.id, user.name, primaryRole.roleCode, user.localAccount.loginName);
  }

  async touchLocalLoginSuccess(userId: string): Promise<void> {
    await this.prisma.localAccount.update({
      where: { userId },
      data: {
        lastLoginAt: new Date()
      }
    });
  }

  private toAuthUser(id: string, name: string, role: string, loginName: string): AuthUser {
    return {
      id,
      name,
      role,
      loginName
    };
  }
}
