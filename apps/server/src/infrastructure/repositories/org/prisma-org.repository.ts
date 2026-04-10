import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import {
  type AdminLocalAccountInput,
  type AdminOrgBootstrap,
  type AdminOrgBootstrapInput,
  type AdminReviewGroupInput,
  ORG_REPOSITORY,
  OrgRepository
} from './org.repository';
import { REVIEW_GRADE_CODES } from '../../../shared/constants/review-grade-codes';

@Injectable()
export class PrismaOrgRepository implements OrgRepository {
  constructor(private readonly prisma: PrismaService) {}

  countActiveUsersByReviewGroupId(reviewGroupId: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        reviewGroupId,
        isActive: true
      }
    });
  }

  async getAdminBootstrap(): Promise<AdminOrgBootstrap> {
    const [departments, sections, users, localAccounts, roleAssignments, sectionLeaderBindings, groupLeaderBindings, reviewGroups] =
      await this.prisma.$transaction([
        this.prisma.department.findMany({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' }
        }),
        this.prisma.section.findMany({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' }
        }),
        this.prisma.user.findMany({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' }
        }),
        this.prisma.localAccount.findMany({
          where: {
            user: {
              isActive: true
            }
          },
          orderBy: { createdAt: 'asc' }
        }),
        this.prisma.userRoleAssignment.findMany({
          where: {
            isEnabled: true,
            user: {
              isActive: true
            }
          },
          orderBy: { createdAt: 'asc' }
        }),
        this.prisma.sectionLeaderBinding.findMany({
          where: {
            leader: {
              isActive: true
            },
            section: {
              isActive: true
            }
          },
          orderBy: { createdAt: 'asc' }
        }),
        this.prisma.groupLeaderBinding.findMany({
          where: {
            leader: {
              isActive: true
            },
            reviewGroup: {
              isActive: true
            }
          },
          orderBy: { createdAt: 'asc' }
        }),
        this.prisma.reviewGroup.findMany({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          include: {
            quotas: {
              orderBy: { gradeCode: 'asc' }
            },
            users: {
              where: { isActive: true },
              select: { id: true }
            }
          }
        })
      ]);

    return {
      departments: departments.map((department) => ({
        id: department.id,
        name: department.name,
        isActive: department.isActive
      })),
      sections: sections.map((section) => ({
        id: section.id,
        departmentId: section.departmentId,
        name: section.name,
        isActive: section.isActive
      })),
      users: users.map((user) => ({
        id: user.id,
        employeeNo: user.employeeNo,
        name: user.name,
        departmentId: user.departmentId,
        sectionId: user.sectionId,
        reviewGroupId: user.reviewGroupId,
        isActive: user.isActive
      })),
      localAccounts: localAccounts.map((account) => ({
        userId: account.userId,
        loginName: account.loginName,
        localLoginEnabled: account.localLoginEnabled
      })),
      roleAssignments: roleAssignments.map((assignment) => ({
        id: assignment.id,
        userId: assignment.userId,
        roleCode: assignment.roleCode,
        scopeType: assignment.scopeType,
        scopeId: assignment.scopeId,
        isPrimary: assignment.isPrimary,
        isEnabled: assignment.isEnabled
      })),
      sectionLeaderBindings: sectionLeaderBindings.map((binding) => ({
        id: binding.id,
        leaderUserId: binding.leaderUserId,
        sectionId: binding.sectionId
      })),
      groupLeaderBindings: groupLeaderBindings.map((binding) => ({
        id: binding.id,
        leaderUserId: binding.leaderUserId,
        reviewGroupId: binding.reviewGroupId
      })),
      reviewGroups: reviewGroups.map((reviewGroup) => ({
        id: reviewGroup.id,
        name: reviewGroup.name,
        isActive: reviewGroup.isActive,
        memberCount: reviewGroup.users.length,
        quotas: REVIEW_GRADE_CODES.map((gradeCode) => ({
          gradeCode,
          seatCount: reviewGroup.quotas.find((quota) => quota.gradeCode === gradeCode)?.seatCount ?? 0
        }))
      }))
    };
  }

  async saveAdminBootstrap(input: AdminOrgBootstrapInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existingLocalAccounts = await tx.localAccount.findMany();
      const existingAccountsByUserId = new Map(existingLocalAccounts.map((account) => [account.userId, account]));
      const existingAssignments = await tx.userRoleAssignment.findMany();
      const existingAssignmentsById = new Map(existingAssignments.map((assignment) => [assignment.id, assignment]));
      const existingAssignmentsByComposite = new Map(
        existingAssignments.map((assignment) => [
          `${assignment.userId}|${assignment.roleCode}|${assignment.scopeType}|${assignment.scopeId}`,
          assignment
        ])
      );

      for (const department of input.departments) {
        await tx.department.upsert({
          where: { id: department.id },
          update: {
            name: department.name,
            isActive: department.isActive
          },
          create: {
            id: department.id,
            name: department.name,
            isActive: department.isActive
          }
        });
      }

      await tx.department.updateMany({
        where: {
          isActive: true,
          id: {
            notIn: input.departments.map((entry) => entry.id)
          }
        },
        data: {
          isActive: false
        }
      });

      for (const reviewGroup of input.reviewGroups) {
        await tx.reviewGroup.upsert({
          where: { id: reviewGroup.id },
          update: {
            name: reviewGroup.name,
            isActive: reviewGroup.isActive
          },
          create: {
            id: reviewGroup.id,
            name: reviewGroup.name,
            isActive: reviewGroup.isActive
          }
        });
      }

      await tx.reviewGroup.updateMany({
        where: {
          isActive: true,
          id: {
            notIn: input.reviewGroups.map((entry) => entry.id)
          }
        },
        data: {
          isActive: false
        }
      });

      for (const section of input.sections) {
        await tx.section.upsert({
          where: { id: section.id },
          update: {
            departmentId: section.departmentId,
            name: section.name,
            isActive: section.isActive
          },
          create: {
            id: section.id,
            departmentId: section.departmentId,
            name: section.name,
            isActive: section.isActive
          }
        });
      }

      await tx.section.updateMany({
        where: {
          isActive: true,
          id: {
            notIn: input.sections.map((entry) => entry.id)
          }
        },
        data: {
          isActive: false
        }
      });

      for (const user of input.users) {
        await tx.user.upsert({
          where: { id: user.id },
          update: {
            employeeNo: user.employeeNo,
            name: user.name,
            departmentId: user.departmentId,
            sectionId: user.sectionId,
            reviewGroupId: user.reviewGroupId,
            isActive: user.isActive
          },
          create: {
            id: user.id,
            employeeNo: user.employeeNo,
            name: user.name,
            departmentId: user.departmentId,
            sectionId: user.sectionId,
            reviewGroupId: user.reviewGroupId,
            isActive: user.isActive
          }
        });
      }

      await tx.user.updateMany({
        where: {
          isActive: true,
          id: {
            notIn: input.users.map((entry) => entry.id)
          }
        },
        data: {
          isActive: false,
          departmentId: null,
          sectionId: null,
          reviewGroupId: null
        }
      });

      for (const account of input.localAccounts) {
        const normalizedLoginName = account.loginName.trim().toLowerCase();
        const existingAccount = existingAccountsByUserId.get(account.userId);
        const nextPasswordHash = await this.resolvePasswordHash(account, existingAccount?.passwordHash);

        await tx.localAccount.upsert({
          where: { userId: account.userId },
          update: {
            loginName: normalizedLoginName,
            passwordHash: nextPasswordHash,
            localLoginEnabled: account.localLoginEnabled
          },
          create: {
            userId: account.userId,
            loginName: normalizedLoginName,
            passwordHash: nextPasswordHash,
            localLoginEnabled: account.localLoginEnabled
          }
        });
      }

      await tx.localAccount.updateMany({
        where: {
          userId: {
            notIn: input.localAccounts.map((entry) => entry.userId)
          }
        },
        data: {
          localLoginEnabled: false
        }
      });

      const persistedAssignmentIds: string[] = [];

      for (const assignment of input.roleAssignments) {
        const compositeKey = `${assignment.userId}|${assignment.roleCode}|${assignment.scopeType}|${assignment.scopeId}`;
        const existingAssignment = existingAssignmentsById.get(assignment.id) ?? existingAssignmentsByComposite.get(compositeKey);
        const assignmentId = assignment.id || existingAssignment?.id || randomUUID();

        await tx.userRoleAssignment.upsert({
          where: { id: assignmentId },
          update: {
            userId: assignment.userId,
            roleCode: assignment.roleCode,
            scopeType: assignment.scopeType,
            scopeId: assignment.scopeId,
            isPrimary: assignment.isPrimary,
            isEnabled: assignment.isEnabled
          },
          create: {
            id: assignmentId,
            userId: assignment.userId,
            roleCode: assignment.roleCode,
            scopeType: assignment.scopeType,
            scopeId: assignment.scopeId,
            isPrimary: assignment.isPrimary,
            isEnabled: assignment.isEnabled
          }
        });

        persistedAssignmentIds.push(assignmentId);
      }

      await tx.userRoleAssignment.updateMany({
        where: {
          isEnabled: true,
          id: {
            notIn: persistedAssignmentIds
          }
        },
        data: {
          isEnabled: false,
          isPrimary: false
        }
      });

      await tx.sectionLeaderBinding.deleteMany({});
      if (input.sectionLeaderBindings.length > 0) {
        await tx.sectionLeaderBinding.createMany({
          data: input.sectionLeaderBindings.map((binding) => ({
            id: binding.id,
            leaderUserId: binding.leaderUserId,
            sectionId: binding.sectionId
          }))
        });
      }

      await tx.groupLeaderBinding.deleteMany({});
      if (input.groupLeaderBindings.length > 0) {
        await tx.groupLeaderBinding.createMany({
          data: input.groupLeaderBindings.map((binding) => ({
            id: binding.id,
            leaderUserId: binding.leaderUserId,
            reviewGroupId: binding.reviewGroupId
          }))
        });
      }

      for (const reviewGroup of input.reviewGroups) {
        await tx.reviewGradeQuota.deleteMany({
          where: {
            reviewGroupId: reviewGroup.id
          }
        });

        await tx.reviewGradeQuota.createMany({
          data: reviewGroup.quotas.map((quota) => ({
            reviewGroupId: reviewGroup.id,
            gradeCode: quota.gradeCode,
            seatCount: quota.seatCount
          }))
        });
      }
    });
  }

  private async resolvePasswordHash(account: AdminLocalAccountInput, existingPasswordHash?: string): Promise<string> {
    const nextPassword = account.password?.trim();
    if (nextPassword) {
      return bcrypt.hash(nextPassword, 10);
    }

    if (existingPasswordHash) {
      return existingPasswordHash;
    }

    return bcrypt.hash('Admin123!', 10);
  }
}
