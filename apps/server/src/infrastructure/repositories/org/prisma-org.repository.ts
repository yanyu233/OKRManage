import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  type AdminGoalStatusControlQuery,
  type AdminGoalStatusControlRecord,
  type AdminGoalStatusTransitionInput,
  type AdminLocalAccountInput,
  type AdminOrgBootstrap,
  type AdminOrgBootstrapInput,
  type AdminQuarterParticipationExclusionQuery,
  type AdminQuarterParticipationExclusionRecord,
  type AdminQuarterParticipationExclusionSaveInput,
  type AdminReviewGroupInput,
  ORG_REPOSITORY,
  OrgRepository
} from './org.repository';
import { REVIEW_GRADE_CODES } from '../../../shared/constants/review-grade-codes';
import { DomainValidationError } from '../../../shared/errors/domain-validation.error';

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

  async listGoalStatusControls(input: AdminGoalStatusControlQuery): Promise<AdminGoalStatusControlRecord[]> {
    const goals = await this.prisma.goal.findMany({
      where: {
        year: input.year,
        quarter: input.quarter,
        ownerUserId: input.userId ?? undefined,
        owner: {
          isActive: true,
          roleAssignments: {
            some: {
              roleCode: 'employee',
              isEnabled: true
            }
          }
        }
      },
      orderBy: [{ owner: { createdAt: 'asc' } }, { code: 'asc' }],
      include: {
        owner: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return goals.map((goal) => ({
      goalId: goal.id,
      ownerUserId: goal.owner.id,
      ownerName: goal.owner.name,
      year: goal.year,
      quarter: goal.quarter,
      code: goal.code,
      name: goal.name,
      status: goal.status
    }));
  }

  async transitionGoalStatuses(input: AdminGoalStatusTransitionInput): Promise<number> {
    const currentStatuses =
      input.targetStatus === 'draft'
        ? ['confirmed'] as const
        : input.targetStatus === 'confirmed'
          ? ['draft'] as const
          : ['draft', 'confirmed'] as const;

    const result = await this.prisma.goal.updateMany({
      where: {
        year: input.year,
        quarter: input.quarter,
        ownerUserId: input.userId ?? undefined,
        status: {
          in: [...currentStatuses]
        },
        owner: {
          isActive: true,
          roleAssignments: {
            some: {
              roleCode: 'employee',
              isEnabled: true
            }
          }
        }
      },
      data: {
        status: input.targetStatus
      }
    });

    return result.count;
  }

  async listQuarterParticipationExclusions(
    input: AdminQuarterParticipationExclusionQuery
  ): Promise<AdminQuarterParticipationExclusionRecord[]> {
    const exclusions = await this.prisma.quarterParticipationExclusion.findMany({
      where: {
        year: input.year,
        quarter: input.quarter,
        user: {
          isActive: true,
          roleAssignments: {
            some: {
              roleCode: 'employee',
              isEnabled: true
            }
          }
        }
      },
      orderBy: [{ user: { createdAt: 'asc' } }],
      include: {
        user: {
          include: {
            section: true,
            reviewGroup: true
          }
        }
      }
    });

    return exclusions.map((exclusion) => ({
      id: exclusion.id,
      userId: exclusion.userId,
      userName: exclusion.user.name,
      employeeNo: exclusion.user.employeeNo,
      positionName: exclusion.user.positionName,
      sectionId: exclusion.user.sectionId,
      sectionName: exclusion.user.section?.name ?? null,
      reviewGroupId: exclusion.user.reviewGroupId,
      reviewGroupName: exclusion.user.reviewGroup?.name ?? null
    }));
  }

  async saveQuarterParticipationExclusions(input: AdminQuarterParticipationExclusionSaveInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.quarterParticipationExclusion.deleteMany({
        where: {
          year: input.year,
          quarter: input.quarter
        }
      });

      if (input.userIds.length > 0) {
        await tx.quarterParticipationExclusion.createMany({
          data: input.userIds.map((userId) => ({
            userId,
            year: input.year,
            quarter: input.quarter
          }))
        });
      }
    });
  }

  async getAdminBootstrap(): Promise<AdminOrgBootstrap> {
    const [departments, sections, users, localAccounts, roleAssignments, sectionLeaderBindings, groupLeaderBindings, reviewGroups, goalTemplates] =
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
        }),
        this.prisma.goalTemplate.findMany({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          include: {
            keyResults: {
              orderBy: { createdAt: 'asc' }
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
        positionName: user.positionName,
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
      })),
      goalTemplates: goalTemplates.map((template) => ({
        id: template.id,
        departmentId: template.departmentId,
        name: template.name,
        description: template.description,
        isActive: template.isActive,
        keyResults: template.keyResults.map((keyResult) => ({
          id: keyResult.id,
          code: keyResult.code,
          name: keyResult.name,
          description: keyResult.description,
          points: keyResult.points,
          scoreType: keyResult.scoreType
        }))
      }))
    };
  }

  async saveAdminBootstrap(input: AdminOrgBootstrapInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existingLocalAccounts = await tx.localAccount.findMany();
      const existingAccountsByUserId = new Map(existingLocalAccounts.map((account) => [account.userId, account]));
      const existingAssignments = await tx.userRoleAssignment.findMany();
      const existingTemplates = await tx.goalTemplate.findMany();
      const existingAssignmentsById = new Map(existingAssignments.map((assignment) => [assignment.id, assignment]));
      const existingAssignmentsByComposite = new Map(
        existingAssignments.map((assignment) => [
          `${assignment.userId}|${assignment.roleCode}|${assignment.scopeType}|${assignment.scopeId}`,
          assignment
        ])
      );
      const existingTemplatesById = new Map(existingTemplates.map((template) => [template.id, template]));
      const existingTemplatesByComposite = new Map(
        existingTemplates.map((template) => [`${template.departmentId}|${template.name.toLowerCase()}`, template])
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

      const persistedTemplateIds = input.goalTemplates.map((entry) => {
        if (existingTemplatesById.has(entry.id)) {
          return entry.id;
        }

        const existingTemplate = existingTemplatesByComposite.get(`${entry.departmentId}|${entry.name.toLowerCase()}`);
        return existingTemplate?.id ?? entry.id;
      });

      await tx.goalTemplateKeyResult.deleteMany({
        where: {
          goalTemplateId: {
            in: persistedTemplateIds
          }
        }
      });

      for (const [index, template] of input.goalTemplates.entries()) {
        const persistedTemplateId = persistedTemplateIds[index];

        try {
          await tx.goalTemplate.upsert({
            where: { id: persistedTemplateId },
            update: {
              departmentId: template.departmentId,
              name: template.name,
              description: template.description,
              isActive: template.isActive
            },
            create: {
              id: persistedTemplateId,
              departmentId: template.departmentId,
              name: template.name,
              description: template.description,
              isActive: template.isActive
            }
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002' &&
            String(error.meta?.target ?? '').includes('GoalTemplate_departmentId_name_key')
          ) {
            throw new DomainValidationError(`duplicate goal template name in department: ${template.name}`);
          }

          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2000' &&
            String(error.meta?.column_name ?? '').includes('description')
          ) {
            throw new DomainValidationError('template description is too long');
          }

          throw error;
        }

        if (template.keyResults.length > 0) {
          try {
            await tx.goalTemplateKeyResult.createMany({
              data: template.keyResults.map((keyResult) => ({
                id: keyResult.id,
                goalTemplateId: persistedTemplateId,
                code: keyResult.code,
                name: keyResult.name,
                description: keyResult.description,
                points: keyResult.points,
                scoreType: keyResult.scoreType ?? 'subjective'
              }))
            });
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2000' &&
              String(error.meta?.column_name ?? '').includes('description')
            ) {
              throw new DomainValidationError('template key result description is too long');
            }

            throw error;
          }
        }
      }

      await this.syncImportedTemplateGoals(
        tx,
        input.goalTemplates.map((template, index) => ({
          ...template,
          id: persistedTemplateIds[index]
        }))
      );

      if (persistedTemplateIds.length > 0) {
        await tx.goalTemplate.updateMany({
          where: {
            isActive: true,
            id: {
              notIn: persistedTemplateIds
            }
          },
          data: {
            isActive: false
          }
        });
      } else {
        await tx.goalTemplate.updateMany({
          where: {
            isActive: true
          },
          data: {
            isActive: false
          }
        });
      }

      for (const section of input.sections) {
        try {
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
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002' &&
            String(error.meta?.target ?? '').includes('Section_departmentId_name_key')
          ) {
            throw new DomainValidationError(`duplicate section name in department: ${section.name}`);
          }

          throw error;
        }
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
            positionName: user.positionName,
            departmentId: user.departmentId,
            sectionId: user.sectionId,
            reviewGroupId: user.reviewGroupId,
            isActive: user.isActive
          },
          create: {
            id: user.id,
            employeeNo: user.employeeNo,
            name: user.name,
            positionName: user.positionName,
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

      const enabledRoleAssignmentsByUserId = new Map<string, Array<(typeof input.roleAssignments)[number]>>();
      for (const assignment of input.roleAssignments) {
        if (!assignment.isEnabled) {
          continue;
        }

        const current = enabledRoleAssignmentsByUserId.get(assignment.userId);
        if (current) {
          current.push(assignment);
          continue;
        }

        enabledRoleAssignmentsByUserId.set(assignment.userId, [assignment]);
      }

      for (const user of input.users) {
        if (!user.isActive) {
          continue;
        }

        const enabledAssignments = enabledRoleAssignmentsByUserId.get(user.id) ?? [];
        // Keep the legacy "new active user defaults to employee" behavior only when
        // the user has no enabled roles at all. A pure leader account should be able
        // to exist without the employee role and must not be auto-restored here.
        if (enabledAssignments.length > 0) {
          continue;
        }

        const employeeCompositeKey = `${user.id}|employee|user|${user.id}`;
        const existingEmployeeAssignment = existingAssignmentsByComposite.get(employeeCompositeKey);
        const assignmentId = existingEmployeeAssignment?.id ?? randomUUID();
        const isPrimary = !enabledAssignments.some((assignment) => assignment.isPrimary);

        await tx.userRoleAssignment.upsert({
          where: { id: assignmentId },
          update: {
            userId: user.id,
            roleCode: 'employee',
            scopeType: 'user',
            scopeId: user.id,
            isPrimary,
            isEnabled: true
          },
          create: {
            id: assignmentId,
            userId: user.id,
            roleCode: 'employee',
            scopeType: 'user',
            scopeId: user.id,
            isPrimary,
            isEnabled: true
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

  private async syncImportedTemplateGoals(
    tx: Prisma.TransactionClient,
    templates: Array<
      AdminOrgBootstrapInput['goalTemplates'][number] & {
        id: string;
      }
    >
  ): Promise<void> {
    if (templates.length === 0) {
      return;
    }

    for (const template of templates) {
      const importedGoals = await tx.goal.findMany({
        where: {
          importedTemplates: {
            some: {
              goalTemplateId: template.id
            }
          }
        },
        include: {
          keyResults: true
        }
      });

      if (importedGoals.length === 0) {
        continue;
      }

      const templateKeyResultsByCode = new Map(template.keyResults.map((keyResult) => [keyResult.code, keyResult]));

      for (const goal of importedGoals) {
        const nextTotalPoints = goal.keyResults.reduce((sum, keyResult) => {
          const syncedTemplateKeyResult = templateKeyResultsByCode.get(keyResult.code);
          return sum + (syncedTemplateKeyResult?.points ?? keyResult.points);
        }, 0);

        await tx.goal.update({
          where: { id: goal.id },
          data: {
            name: template.name,
            description: template.description,
            totalPoints: nextTotalPoints
          }
        });

        for (const keyResult of goal.keyResults) {
          const syncedTemplateKeyResult = templateKeyResultsByCode.get(keyResult.code);
          if (!syncedTemplateKeyResult) {
            continue;
          }

          await tx.keyResult.update({
            where: { id: keyResult.id },
            data: {
              name: syncedTemplateKeyResult.name,
              description: syncedTemplateKeyResult.description,
              points: syncedTemplateKeyResult.points,
              scoreType: syncedTemplateKeyResult.scoreType ?? 'subjective'
            }
          });
        }
      }
    }
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
