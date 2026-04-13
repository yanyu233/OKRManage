import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../../shared/types/auth-user';
import { DomainValidationError } from '../../../shared/errors/domain-validation.error';
import {
  EmployeeCompletionUpdateResult,
  EmployeeCreateGoalInput,
  EmployeeGoalCreateResult,
  EmployeeGoalDetailRecord,
  EmployeeGoalUpdateInput,
  EmployeeGoalSummaryRecord,
  EmployeeGoalTemplateImportResult,
  EmployeeGoalTemplateRecord,
  EmployeeKeyResultRecord,
  EmployeeProofRecord,
  EmployeeProofUploadResult,
  EmployeeQuarterRecord,
  EmployeeQuarterSummaryRecord,
  EmployeeRepository,
  ProofDownloadRecord
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

@Injectable()
export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

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

    const importedGoals = await this.prisma.$transaction(async (transaction) => {
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
    });

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

  async submitGoalForReview(actor: AuthUser, goalId: string): Promise<EmployeeGoalDetailRecord> {
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
          },
          owner: true
        }
      });

      if (!goal) {
        throw new NotFoundException('goal not found');
      }

      if (goal.ownerUserId !== actor.id) {
        throw new ForbiddenException('employee scope mismatch');
      }

      if (goal.status !== 'confirmed') {
        throw new DomainValidationError('only confirmed goals can be submitted for review');
      }

      if (!goal.keyResults.length) {
        throw new DomainValidationError('goal requires at least one key result before review');
      }

      const hasIncompleteKeyResult = goal.keyResults.some((keyResult) => keyResult.completionState !== 'completed');
      if (hasIncompleteKeyResult) {
        throw new DomainValidationError('all key results must be completed before submitting for review');
      }

      await transaction.goal.update({
        where: { id: goalId },
        data: {
          status: 'pending-review'
        }
      });

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
    const keyResult = await this.prisma.keyResult.findUnique({
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

    const proof = await this.prisma.proof.create({
      data: {
        keyResultId: krId,
        fileName: input.fileName,
        fileUrl: input.storageKey,
        fileSize: input.fileSize,
        note: input.note
      }
    });

    return {
      keyResultId: krId,
      proof: this.toProofRecord(proof)
    };
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

    return {
      id: employee.id,
      name: employee.name,
      sectionName: employee.section?.name ?? null,
      reviewGroupName: employee.reviewGroup?.name ?? null,
      goalCount: employee.ownedGoals.length,
      keyResultCount: keyResults.length,
      completedKeyResultCount: keyResults.filter((keyResult) => keyResult.completionState === 'completed').length,
      proofCount: keyResults.reduce((sum, keyResult) => sum + keyResult.proofs.length, 0),
      quarterScore: scoreFromKeyResults(keyResults)
    };
  }

  private toGoalSummary(goal: GoalWithQuarterData): EmployeeGoalSummaryRecord {
    return {
      id: goal.id,
      code: goal.code,
      name: goal.name,
      description: goal.description,
      status: goal.status,
      totalPoints: goal.totalPoints,
      keyResultCount: goal.keyResults.length,
      completedKeyResultCount: goal.keyResults.filter((keyResult) => keyResult.completionState === 'completed').length,
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
      proofCount: keyResult.proofs.length,
      proofs: keyResult.proofs.map((proof) => this.toProofRecord(proof))
    };
  }

  private toProofRecord(proof: KeyResultWithProofs['proofs'][number]): EmployeeProofRecord {
    return {
      id: proof.id,
      fileName: proof.fileName,
      fileUrl: `/api/employee/proofs/${proof.id}/download`,
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
