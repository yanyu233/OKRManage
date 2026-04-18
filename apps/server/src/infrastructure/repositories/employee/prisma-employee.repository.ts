import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../../shared/types/auth-user';
import { DomainValidationError } from '../../../shared/errors/domain-validation.error';
import { RuntimeConfigService } from '../../../modules/config/runtime-config.service';
import { buildProofDownloadUrl, buildProofPreviewUrl } from '../../../shared/proof/proof-links';
import {
  EmployeeCompletionUpdateResult,
  EmployeeCreateGoalInput,
  EmployeeGoalDeleteResult,
  EmployeeGoalCreateResult,
  EmployeeGoalDetailRecord,
  EmployeeGoalUpdateInput,
  EmployeeGoalSummaryRecord,
  EmployeeGoalTemplateImportResult,
  EmployeeGoalTemplateRecord,
  EmployeeKeyResultDeleteResult,
  EmployeeKeyResultRecord,
  EmployeeProofRecord,
  EmployeeProofUploadResult,
  EmployeeQuarterRecord,
  EmployeeQuarterSummaryRecord,
  EmployeeRepository,
  ProofDownloadRecord,
  ProofStorageRecord
} from './employee.repository';

type EmployeeWithQuarterData = Prisma.UserGetPayload<{
  include: {
    section: true;
    reviewGroup: true;
    ownedGoals: {
      include: {
        importedTemplates: true;
        keyResults: {
          include: {
            proofs: true;
          };
        };
      };
    };
  };
}>;
type GoalWithQuarterData = EmployeeWithQuarterData['ownedGoals'][number];
type KeyResultWithProofs = GoalWithQuarterData['keyResults'][number];
type ProofWithOwner = Prisma.ProofGetPayload<{
  include: {
    keyResult: {
      include: {
        goal: {
          include: {
            owner: true;
          };
        };
      };
    };
  };
}>;
const MAX_EMPLOYEE_QUARTER_POINTS = 100;

@Injectable()
export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeConfig: RuntimeConfigService
  ) {}

  async getQuarterOverview(actor: AuthUser, year: number, quarter: number): Promise<EmployeeQuarterRecord> {
    const employee = await this.requireEmployeeQuarter(actor.id, year, quarter);

    return {
      year,
      quarter,
      employee: this.toEmployeeQuarterSummary(employee),
      goals: employee.ownedGoals.map((goal) => this.toGoalSummary(goal))
    };
  }

  async getGoalTemplates(actor: AuthUser, year: number, quarter: number): Promise<EmployeeGoalTemplateRecord> {
    const employee = await this.prisma.user.findUnique({
      where: { id: actor.id },
      include: {
        department: {
          include: {
            goalTemplates: {
              where: {
                isActive: true
              },
              orderBy: {
                createdAt: 'asc'
              },
              include: {
                keyResults: {
                  orderBy: {
                    code: 'asc'
                  }
                },
                imports: {
                  where: {
                    ownerUserId: actor.id,
                    year,
                    quarter
                  },
                  select: {
                    id: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!employee) {
      throw new NotFoundException('employee not found');
    }

    if (!employee.departmentId || !employee.department) {
      return {
        year,
        quarter,
        departmentId: null,
        departmentName: null,
        templates: []
      };
    }

    return {
      year,
      quarter,
      departmentId: employee.departmentId,
      departmentName: employee.department.name,
      templates: employee.department.goalTemplates.map((template) => ({
        id: template.id,
        departmentId: template.departmentId,
        departmentName: employee.department?.name ?? null,
        name: template.name,
        description: template.description,
        isActive: template.isActive,
        totalPoints: template.keyResults.reduce((sum, keyResult) => sum + keyResult.points, 0),
        keyResultCount: template.keyResults.length,
        alreadyImported: template.imports.length > 0,
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

  async createGoal(actor: AuthUser, input: EmployeeCreateGoalInput): Promise<EmployeeGoalCreateResult> {
    const created = await this.prisma.$transaction(async (transaction) => {
      await this.assertQuarterPointBudget(transaction, {
        ownerUserId: actor.id,
        year: input.year,
        quarter: input.quarter,
        nextPoints: input.keyResults.reduce((sum, keyResult) => sum + keyResult.points, 0)
      });

      const goal = await transaction.goal.create({
        data: {
          ownerUserId: actor.id,
          year: input.year,
          quarter: input.quarter,
          code: `TMP-CREATE-${Date.now()}`,
          name: input.name,
          description: input.description,
          status: 'draft',
          totalPoints: input.keyResults.reduce((sum, keyResult) => sum + keyResult.points, 0)
        }
      });

      if (input.keyResults.length > 0) {
        await transaction.keyResult.createMany({
          data: input.keyResults.map((keyResult) => ({
            goalId: goal.id,
            code: keyResult.code,
            name: keyResult.name,
            description: keyResult.description,
            points: keyResult.points,
            scoreType: keyResult.scoreType ?? 'objective',
            completionState: 'incomplete'
          }))
        });
      }

      await this.resequenceQuarterGoals(transaction, actor.id, input.year, input.quarter);

      return transaction.goal.findUniqueOrThrow({
        where: { id: goal.id },
        include: {
          importedTemplates: true,
          keyResults: {
            orderBy: {
              code: 'asc'
            },
            include: {
              proofs: {
                orderBy: {
                  uploadedAt: 'desc'
                }
              }
            }
          },
          owner: true
        }
      });
    });

    const detail = this.toGoalDetail(created);
    return {
      ...detail,
      owner: {
        id: created.owner.id,
        name: created.owner.name
      }
    };
  }

  async updateGoal(actor: AuthUser, goalId: string, input: EmployeeGoalUpdateInput): Promise<EmployeeGoalDetailRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const goal = await transaction.goal.findUnique({
        where: { id: goalId },
        include: {
          importedTemplates: true,
          keyResults: {
            orderBy: {
              code: 'asc'
            },
            include: {
              proofs: {
                orderBy: {
                  uploadedAt: 'desc'
                }
              }
            }
          }
        }
      });

      if (!goal) {
        throw new NotFoundException('goal not found');
      }

      if (goal.ownerUserId !== actor.id) {
        throw new ForbiddenException('employee scope mismatch');
      }

      if (goal.status !== 'draft') {
        throw new DomainValidationError('goal can only be edited in draft status');
      }

      await this.assertQuarterPointBudget(transaction, {
        ownerUserId: actor.id,
        year: goal.year,
        quarter: goal.quarter,
        nextPoints: input.keyResults.reduce((sum, keyResult) => sum + keyResult.points, 0),
        excludeGoalId: goalId
      });

      const existingKeyResultsById = new Map(goal.keyResults.map((keyResult) => [keyResult.id, keyResult]));
      const nextKeyResultIds = new Set(input.keyResults.map((keyResult) => keyResult.id).filter(Boolean) as string[]);

      for (const existingKeyResult of goal.keyResults) {
        if (nextKeyResultIds.has(existingKeyResult.id)) {
          continue;
        }

        if (existingKeyResult.proofs.length > 0) {
          throw new DomainValidationError(`key result ${existingKeyResult.code} has uploaded proofs and cannot be removed`);
        }
      }

      await transaction.goal.update({
        where: { id: goalId },
        data: {
          name: input.name,
          description: input.description,
          totalPoints: input.keyResults.reduce((sum, keyResult) => sum + keyResult.points, 0)
        }
      });

      const removedKeyResultIds = goal.keyResults
        .filter((keyResult) => !nextKeyResultIds.has(keyResult.id))
        .map((keyResult) => keyResult.id);
      if (removedKeyResultIds.length > 0) {
        await transaction.keyResult.deleteMany({
          where: {
            id: {
              in: removedKeyResultIds
            }
          }
        });
      }

      for (const keyResult of input.keyResults) {
        if (keyResult.id) {
          const existingKeyResult = existingKeyResultsById.get(keyResult.id);
          if (!existingKeyResult || existingKeyResult.goalId !== goalId) {
            throw new DomainValidationError(`key result ${keyResult.code} is invalid for this goal`);
          }

          await transaction.keyResult.update({
            where: { id: keyResult.id },
            data: {
              code: keyResult.code,
              name: keyResult.name,
              description: keyResult.description,
              points: keyResult.points,
              scoreType: keyResult.scoreType ?? 'objective'
            }
          });
          continue;
        }

        await transaction.keyResult.create({
          data: {
            goalId,
            code: keyResult.code,
            name: keyResult.name,
            description: keyResult.description,
            points: keyResult.points,
            scoreType: keyResult.scoreType ?? 'objective',
            completionState: 'incomplete'
          }
        });
      }

      const refreshed = await transaction.goal.findUniqueOrThrow({
        where: { id: goalId },
        include: {
          importedTemplates: true,
          keyResults: {
            orderBy: {
              code: 'asc'
            },
            include: {
              proofs: {
                orderBy: {
                  uploadedAt: 'desc'
                }
              }
            }
          },
          owner: true
        }
      });

      return this.toGoalDetail(refreshed);
    });
  }

  async deleteGoal(actor: AuthUser, goalId: string): Promise<EmployeeGoalDeleteResult> {
    return this.prisma.$transaction(async (transaction) => {
      const goal = await transaction.goal.findUnique({
        where: { id: goalId },
        include: {
          keyResults: {
            include: {
              proofs: true
            }
          }
        }
      });

      if (!goal) {
        throw new NotFoundException('goal not found');
      }

      if (goal.ownerUserId !== actor.id) {
        throw new ForbiddenException('employee scope mismatch');
      }

      if (goal.status !== 'draft') {
        throw new DomainValidationError('goal can only be deleted in draft status');
      }

      const removedProofStorageKeys = goal.keyResults.flatMap((keyResult) => keyResult.proofs.map((proof) => proof.fileUrl));

      await transaction.goal.delete({
        where: { id: goalId }
      });

      await this.resequenceQuarterGoals(transaction, actor.id, goal.year, goal.quarter);

      return {
        goalId: goal.id,
        year: goal.year,
        quarter: goal.quarter,
        code: goal.code,
        name: goal.name,
        removedProofStorageKeys
      };
    });
  }

  async importGoalTemplates(
    actor: AuthUser,
    year: number,
    quarter: number,
    templateIds: string[]
  ): Promise<EmployeeGoalTemplateImportResult> {
    const employee = await this.prisma.user.findUnique({
      where: { id: actor.id },
      include: {
        department: true
      }
    });

    if (!employee) {
      throw new NotFoundException('employee not found');
    }

    if (!employee.departmentId) {
      throw new DomainValidationError('employee department is required');
    }

    const templates = await this.prisma.goalTemplate.findMany({
      where: {
        id: {
          in: templateIds
        },
        departmentId: employee.departmentId,
        isActive: true
      },
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        keyResults: {
          orderBy: {
            code: 'asc'
          }
        }
      }
    });

    if (templates.length !== templateIds.length) {
      throw new DomainValidationError('selected template is unavailable');
    }

    const existingImports = await this.prisma.importedGoalTemplate.findMany({
      where: {
        ownerUserId: actor.id,
        year,
        quarter,
        goalTemplateId: {
          in: templateIds
        }
      },
      select: {
        goalTemplateId: true
      }
    });

    if (existingImports.length > 0) {
      throw new DomainValidationError('selected template already imported for this quarter');
    }

    const importedGoals = await this.withFriendlyDescriptionLimit(async () =>
      this.prisma.$transaction(async (transaction) => {
        await this.assertQuarterPointBudget(transaction, {
          ownerUserId: actor.id,
          year,
          quarter,
          nextPoints: templates.reduce(
            (sum, template) => sum + template.keyResults.reduce((templateSum, keyResult) => templateSum + keyResult.points, 0),
            0
          )
        });

        const importedGoalIds: string[] = [];
        const temporaryCodePrefix = `TMP-IMPORT-${Date.now()}`;

        for (const [index, templateId] of templateIds.entries()) {
          const template = templates.find((entry) => entry.id === templateId);
          if (!template) {
            throw new DomainValidationError('selected template is unavailable');
          }

          const goal = await transaction.goal.create({
            data: {
              ownerUserId: actor.id,
              year,
              quarter,
              code: `${temporaryCodePrefix}-${index + 1}`,
              name: template.name,
              description: template.description,
              status: 'draft',
              totalPoints: template.keyResults.reduce((sum, keyResult) => sum + keyResult.points, 0)
            }
          });

          if (template.keyResults.length > 0) {
            await transaction.keyResult.createMany({
              data: template.keyResults.map((keyResult) => ({
                goalId: goal.id,
                code: keyResult.code,
                name: keyResult.name,
                description: keyResult.description,
                points: keyResult.points,
                scoreType: keyResult.scoreType,
                completionState: 'incomplete'
              }))
            });
          }

          await transaction.importedGoalTemplate.create({
            data: {
              goalTemplateId: template.id,
              goalId: goal.id,
              ownerUserId: actor.id,
              year,
              quarter
            }
          });
          importedGoalIds.push(goal.id);
        }

        await this.resequenceQuarterGoals(transaction, actor.id, year, quarter);

        const importedGoals = await transaction.goal.findMany({
          where: {
            id: {
              in: importedGoalIds
            }
          },
          include: {
            importedTemplates: true,
            keyResults: {
              include: {
                proofs: true
              }
            }
          }
        });

        return importedGoals
          .slice()
          .sort((left, right) => compareGoalCode(left.code, right.code))
          .map((goal) => this.toGoalSummary(goal as GoalWithQuarterData));
      })
    );

    return {
      year,
      quarter,
      importedGoals
    };
  }

  async getGoalDetail(actor: AuthUser, goalId: string): Promise<EmployeeGoalDetailRecord> {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
      include: {
        importedTemplates: true,
        keyResults: {
          orderBy: {
            code: 'asc'
          },
          include: {
            proofs: {
              orderBy: {
                uploadedAt: 'desc'
              }
            }
          }
        },
        owner: {
          include: {
            section: true,
            reviewGroup: true
          }
        }
      }
    });

    if (!goal) {
      throw new NotFoundException('goal not found');
    }

    if (goal.ownerUserId !== actor.id) {
      throw new ForbiddenException('employee scope mismatch');
    }

    return this.toGoalDetail(goal);
  }

  async deleteKeyResult(actor: AuthUser, krId: string): Promise<EmployeeKeyResultDeleteResult> {
    return this.prisma.$transaction(async (transaction) => {
      const keyResult = await transaction.keyResult.findUnique({
        where: { id: krId },
        include: {
          proofs: true,
          goal: {
            include: {
              keyResults: {
                orderBy: {
                  code: 'asc'
                }
              }
            }
          }
        }
      });

      if (!keyResult) {
        throw new NotFoundException('key result not found');
      }

      if (keyResult.goal.ownerUserId !== actor.id) {
        throw new ForbiddenException('employee scope mismatch');
      }

      if (keyResult.goal.status !== 'draft') {
        throw new DomainValidationError('key result can only be deleted in draft status');
      }

      if (keyResult.goal.keyResults.length <= 1) {
        throw new DomainValidationError('goal must keep at least one key result, delete the goal instead');
      }

      const removedProofStorageKeys = keyResult.proofs.map((proof) => proof.fileUrl);

      await transaction.keyResult.delete({
        where: { id: krId }
      });

      await this.resequenceGoalKeyResults(transaction, keyResult.goalId);

      return {
        goalId: keyResult.goalId,
        keyResultId: keyResult.id,
        code: keyResult.code,
        name: keyResult.name,
        removedProofStorageKeys
      };
    });
  }

  async updateKeyResultCompletion(
    actor: AuthUser,
    krId: string,
    completionState: string
  ): Promise<EmployeeCompletionUpdateResult> {
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: krId },
      include: {
        proofs: {
          orderBy: {
            uploadedAt: 'desc'
          }
        },
        goal: true
      }
    });

    if (!keyResult) {
      throw new NotFoundException('key result not found');
    }

    if (keyResult.goal.ownerUserId !== actor.id) {
      throw new ForbiddenException('employee scope mismatch');
    }

    if (!['draft', 'confirmed'].includes(keyResult.goal.status)) {
      throw new DomainValidationError('key result completion can only be updated before review starts');
    }

    if (completionState === 'completed' && keyResult.proofs.length === 0) {
      throw new DomainValidationError('key result requires at least one proof before marking completed');
    }

    const updated = await this.prisma.keyResult.update({
      where: { id: krId },
      data: {
        completionState
      },
      include: {
        proofs: {
          orderBy: {
            uploadedAt: 'desc'
          }
        }
      }
    });

    return {
      before: {
        id: keyResult.id,
        completionState: keyResult.completionState
      },
      after: this.toKeyResultRecord(updated)
    };
  }

  async createProof(
    actor: AuthUser,
    krId: string,
    input: { fileName: string; storageKey: string; fileSize: number; note: string | null }
  ): Promise<EmployeeProofUploadResult> {
    return this.prisma.$transaction(async (transaction) => {
      const keyResult = await transaction.keyResult.findUnique({
        where: { id: krId },
        include: {
          goal: true
        }
      });

      if (!keyResult) {
        throw new NotFoundException('key result not found');
      }

      if (keyResult.goal.ownerUserId !== actor.id) {
        throw new ForbiddenException('employee scope mismatch');
      }

      const proof = await transaction.proof.create({
        data: {
          keyResultId: krId,
          fileName: input.fileName,
          fileUrl: input.storageKey,
          fileSize: input.fileSize,
          note: input.note
        }
      });

      if (keyResult.completionState !== 'completed') {
        await transaction.keyResult.update({
          where: { id: krId },
          data: {
            completionState: 'completed'
          }
        });
      }

      return {
        keyResultId: krId,
        proof: this.toProofRecord(proof)
      };
    });
  }

  async getProofDownload(actor: AuthUser, proofId: string): Promise<ProofDownloadRecord> {
    const proof = await this.prisma.proof.findUnique({
      where: { id: proofId },
      include: {
        keyResult: {
          include: {
            goal: {
              include: {
                owner: true
              }
            }
          }
        }
      }
    });

    if (!proof) {
      throw new NotFoundException('proof not found');
    }

    const owner = proof.keyResult.goal.owner;
    const canAccess =
      actor.role === 'employee'
        ? owner.id === actor.id
        : actor.role === 'department-head'
          ? true
        : actor.role === 'system-admin'
          ? true
        : actor.role === 'section-leader' || actor.role === 'group-leader'
          ? await this.canLeaderAccessEmployee(actor, owner)
          : false;

    if (!canAccess) {
      throw new ForbiddenException('proof access denied');
    }

    return {
      proofId: proof.id,
      fileName: proof.fileName,
      storageKey: proof.fileUrl
    };
  }

  async getProofStorage(proofId: string): Promise<ProofStorageRecord> {
    const proof = await this.prisma.proof.findUnique({
      where: { id: proofId }
    });

    if (!proof) {
      throw new NotFoundException('proof not found');
    }

    return {
      proofId: proof.id,
      fileName: proof.fileName,
      storageKey: proof.fileUrl
    };
  }

  private async requireEmployeeQuarter(actorUserId: string, year: number, quarter: number): Promise<EmployeeWithQuarterData> {
    const employee = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      include: {
        section: true,
        reviewGroup: true,
        ownedGoals: {
          where: {
            year,
            quarter
          },
          include: {
            importedTemplates: true,
            keyResults: {
              orderBy: {
                code: 'asc'
              },
              include: {
                proofs: {
                  orderBy: {
                    uploadedAt: 'desc'
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!employee) {
      throw new NotFoundException('employee not found');
    }

    return {
      ...employee,
      ownedGoals: employee.ownedGoals.slice().sort((left, right) => compareGoalCode(left.code, right.code))
    };
  }

  private async canLeaderAccessEmployee(actor: AuthUser, employee: User): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: {
        isActive: true,
        roleAssignments: {
          some: {
            roleCode: 'employee',
            isEnabled: true
          }
        },
        id: employee.id
      }
    });

    return count > 0;
  }

  private toEmployeeQuarterSummary(employee: EmployeeWithQuarterData): EmployeeQuarterSummaryRecord {
    const keyResults = employee.ownedGoals.flatMap((goal) => goal.keyResults);
    const missingProofKeyResultCount = keyResults.filter((keyResult) => keyResult.proofs.length === 0).length;

    return {
      id: employee.id,
      name: employee.name,
      sectionName: employee.section?.name ?? null,
      reviewGroupName: employee.reviewGroup?.name ?? null,
      goalCount: employee.ownedGoals.length,
      keyResultCount: keyResults.length,
      completedKeyResultCount: keyResults.filter((keyResult) => keyResult.completionState === 'completed').length,
      missingProofKeyResultCount,
      proofCount: keyResults.reduce((sum, keyResult) => sum + keyResult.proofs.length, 0),
      quarterScore: scoreFromKeyResults(keyResults)
    };
  }

  private toGoalSummary(goal: GoalWithQuarterData): EmployeeGoalSummaryRecord {
    const missingProofKeyResultCount = goal.keyResults.filter((keyResult) => keyResult.proofs.length === 0).length;

    return {
      id: goal.id,
      code: goal.code,
      name: goal.name,
      description: goal.description,
      status: goal.status,
      totalPoints: goal.totalPoints,
      keyResultCount: goal.keyResults.length,
      completedKeyResultCount: goal.keyResults.filter((keyResult) => keyResult.completionState === 'completed').length,
      missingProofKeyResultCount,
      proofCount: goal.keyResults.reduce((sum, keyResult) => sum + keyResult.proofs.length, 0),
      currentScore: scoreFromKeyResults(goal.keyResults)
    };
  }

  private toGoalDetail(goal: GoalWithQuarterData | Prisma.GoalGetPayload<{
    include: {
      importedTemplates: true;
      keyResults: { include: { proofs: true } };
      owner: true;
    };
  }>): EmployeeGoalDetailRecord {
    const summary = this.toGoalSummary(goal as GoalWithQuarterData);

    return {
      ...summary,
      year: goal.year,
      quarter: goal.quarter,
      keyResults: goal.keyResults
        .slice()
        .sort((left, right) => left.code.localeCompare(right.code))
        .map((keyResult) => this.toKeyResultRecord(keyResult as KeyResultWithProofs))
    };
  }

  private toKeyResultRecord(keyResult: KeyResultWithProofs): EmployeeKeyResultRecord {
    const latestProof = keyResult.proofs[0] ?? null;

    return {
      id: keyResult.id,
      code: keyResult.code,
      name: keyResult.name,
      description: keyResult.description,
      points: keyResult.points,
      scoreType: keyResult.scoreType,
      completionState: keyResult.completionState,
      reviewScore: keyResult.reviewScore,
      reviewComment: keyResult.reviewComment,
      hasProofs: keyResult.proofs.length > 0,
      isProofMissing: keyResult.proofs.length === 0,
      proofCount: keyResult.proofs.length,
      latestProofUploadedAt: latestProof?.uploadedAt.toISOString() ?? null,
      proofs: keyResult.proofs.map((proof) => this.toProofRecord(proof))
    };
  }

  private toProofRecord(proof: KeyResultWithProofs['proofs'][number]): EmployeeProofRecord {
    const downloadUrl = buildProofDownloadUrl(proof.id);

    return {
      id: proof.id,
      fileName: proof.fileName,
      previewUrl: buildProofPreviewUrl({
        proofId: proof.id,
        fileName: proof.fileName,
        webBaseUrl: this.runtimeConfig.webBaseUrl,
        sourceBaseUrl: this.runtimeConfig.kkFileViewSourceBaseUrl,
        previewBaseUrl: this.runtimeConfig.kkFileViewPublicBaseUrl,
        previewToken: this.runtimeConfig.kkFileViewPreviewToken
      }),
      downloadUrl,
      fileUrl: downloadUrl,
      fileSize: proof.fileSize,
      note: proof.note,
      uploadedAt: proof.uploadedAt.toISOString()
    };
  }

  private async resequenceQuarterGoals(
    transaction: Prisma.TransactionClient,
    ownerUserId: string,
    year: number,
    quarter: number
  ) {
    const goals = await transaction.goal.findMany({
      where: {
        ownerUserId,
        year,
        quarter
      },
      include: {
        importedTemplates: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    const templateGoals = goals
      .filter((goal) => goal.importedTemplates.length > 0)
      .sort((left, right) => compareImportedGoals(left, right));
    const regularGoals = goals
      .filter((goal) => goal.importedTemplates.length === 0)
      .sort((left, right) => compareGoalCode(left.code, right.code));
    const orderedGoals = [...templateGoals, ...regularGoals];

    for (const [index, goal] of orderedGoals.entries()) {
      await transaction.goal.update({
        where: { id: goal.id },
        data: {
          code: `TMP-ORDER-${index + 1}-${goal.id}`
        }
      });
    }

    for (const [index, goal] of orderedGoals.entries()) {
      await transaction.goal.update({
        where: { id: goal.id },
        data: {
          code: `O${index + 1}`
        }
      });
    }
  }

  private async resequenceGoalKeyResults(transaction: Prisma.TransactionClient, goalId: string) {
    const keyResults = await transaction.keyResult.findMany({
      where: {
        goalId
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    for (const [index, keyResult] of keyResults.entries()) {
      await transaction.keyResult.update({
        where: { id: keyResult.id },
        data: {
          code: `TMP-KR-${index + 1}-${keyResult.id}`
        }
      });
    }

    for (const [index, keyResult] of keyResults.entries()) {
      await transaction.keyResult.update({
        where: { id: keyResult.id },
        data: {
          code: `KR${index + 1}`
        }
      });
    }

    await transaction.goal.update({
      where: { id: goalId },
      data: {
        totalPoints: keyResults.reduce((sum, keyResult) => sum + keyResult.points, 0)
      }
    });
  }

  private async assertQuarterPointBudget(
    transaction: Prisma.TransactionClient,
    input: {
      ownerUserId: string;
      year: number;
      quarter: number;
      nextPoints: number;
      excludeGoalId?: string;
    }
  ) {
    const aggregate = await transaction.goal.aggregate({
      where: {
        ownerUserId: input.ownerUserId,
        year: input.year,
        quarter: input.quarter,
        ...(input.excludeGoalId
          ? {
              id: {
                not: input.excludeGoalId
              }
            }
          : {})
      },
      _sum: {
        totalPoints: true
      }
    });

    const existingPoints = aggregate._sum.totalPoints ?? 0;
    if (existingPoints + input.nextPoints > MAX_EMPLOYEE_QUARTER_POINTS) {
      throw new DomainValidationError('quarter total points cannot exceed 100');
    }
  }

  private async withFriendlyDescriptionLimit<T>(callback: () => Promise<T>) {
    try {
      return await callback();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2000' &&
        String(error.meta?.target ?? '').includes('description')
      ) {
        throw new DomainValidationError('goal or key result description is too long');
      }

      throw error;
    }
  }
}

function scoreFromKeyResults(
  keyResults: Array<{ points: number; reviewScore: number | null }>
): number | null {
  const scored = keyResults.filter((keyResult) => keyResult.reviewScore !== null);
  if (!scored.length) {
    return null;
  }

  const total = scored.reduce((sum, keyResult) => sum + (keyResult.reviewScore ?? 0), 0);
  return Number(total.toFixed(1));
}

function compareGoalCode(left: string, right: string) {
  return extractGoalCodeIndex(left) - extractGoalCodeIndex(right) || left.localeCompare(right);
}

function extractGoalCodeIndex(code: string) {
  const match = /^O(\d+)$/i.exec(code.trim());
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function compareImportedGoals(
  left: { importedTemplates: Array<{ createdAt: Date }>; createdAt: Date; code: string },
  right: { importedTemplates: Array<{ createdAt: Date }>; createdAt: Date; code: string }
) {
  const leftTimestamp = left.importedTemplates[0]?.createdAt?.getTime?.() ?? left.createdAt.getTime();
  const rightTimestamp = right.importedTemplates[0]?.createdAt?.getTime?.() ?? right.createdAt.getTime();

  if (leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }

  return compareGoalCode(left.code, right.code);
}
