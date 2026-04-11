import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../../shared/types/auth-user';
import {
  EmployeeCompletionUpdateResult,
  EmployeeGoalDetailRecord,
  EmployeeGoalSummaryRecord,
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

  async getGoalDetail(actor: AuthUser, goalId: string): Promise<EmployeeGoalDetailRecord> {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
      include: {
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
          orderBy: {
            createdAt: 'asc'
          },
          include: {
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

    return employee;
  }

  private async canLeaderAccessEmployee(actor: AuthUser, employee: User): Promise<boolean> {
    const where = await this.buildVisibleEmployeeWhere(actor);
    const count = await this.prisma.user.count({
      where: {
        ...where,
        id: employee.id
      }
    });

    return count > 0;
  }

  private async buildVisibleEmployeeWhere(actor: AuthUser): Promise<Prisma.UserWhereInput> {
    if (actor.role === 'section-leader') {
      const bindings = await this.prisma.sectionLeaderBinding.findMany({
        where: {
          leaderUserId: actor.id
        },
        select: {
          sectionId: true
        }
      });

      return {
        isActive: true,
        roleAssignments: {
          some: {
            roleCode: 'employee',
            isEnabled: true
          }
        },
        sectionId: {
          in: bindings.map((binding) => binding.sectionId)
        }
      };
    }

    const bindings = await this.prisma.groupLeaderBinding.findMany({
      where: {
        leaderUserId: actor.id
      },
      select: {
        reviewGroupId: true
      }
    });

    return {
      isActive: true,
      roleAssignments: {
        some: {
          roleCode: 'employee',
          isEnabled: true
        }
      },
      reviewGroupId: {
        in: bindings.map((binding) => binding.reviewGroupId)
      }
    };
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
}

function scoreFromKeyResults(
  keyResults: Array<{ points: number; reviewScore: number | null }>
): number | null {
  const scored = keyResults.filter((keyResult) => keyResult.reviewScore !== null);
  if (!scored.length) {
    return null;
  }

  const total = scored.reduce((sum, keyResult) => sum + keyResult.points * ((keyResult.reviewScore ?? 0) / 100), 0);
  return Number(total.toFixed(1));
}
