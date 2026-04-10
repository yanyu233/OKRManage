import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { REVIEW_GRADE_CODES } from '../../../shared/constants/review-grade-codes';
import { AuthUser } from '../../../shared/types/auth-user';
import {
  LeaderEmployeeSummaryRecord,
  LeaderGoalDetailRecord,
  LeaderGoalSummaryRecord,
  LeaderKeyResultRecord,
  LeaderProofRecord,
  LeaderRankingEntryRecord,
  LeaderRankingGoalBreakdownRecord,
  LeaderRankingRecord,
  LeaderRankingSelectedEmployeeRecord,
  LeaderRepository,
  LeaderReviewGroupRecord,
  LeaderScoreUpdateResult,
  LeaderSeatSummaryRecord,
  LeaderWorkbenchRecord
} from './leader.repository';

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

@Injectable()
export class PrismaLeaderRepository implements LeaderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkbench(
    actor: AuthUser,
    year: number,
    quarter: number,
    employeeId?: string | null,
    goalId?: string | null
  ): Promise<LeaderWorkbenchRecord> {
    const employees = await this.getVisibleEmployees(actor, year, quarter);
    const employeeSummaries = employees.map((employee) => this.toEmployeeSummary(employee));
    const selectedEmployee = this.pickEmployee(employees, employeeId);

    if (!selectedEmployee) {
      return {
        year,
        quarter,
        employees: employeeSummaries,
        selectedEmployee: null,
        goals: [],
        selectedGoal: null
      };
    }

    const goalSummaries = selectedEmployee.ownedGoals.map((goal) => this.toGoalSummary(goal));
    const selectedGoal = this.pickGoal(selectedEmployee.ownedGoals, goalId);

    return {
      year,
      quarter,
      employees: employeeSummaries,
      selectedEmployee: this.toEmployeeSummary(selectedEmployee),
      goals: goalSummaries,
      selectedGoal: selectedGoal ? this.toGoalDetail(selectedGoal) : null
    };
  }

  async updateKeyResultScore(actor: AuthUser, krId: string, score: number, comment: string | null): Promise<LeaderScoreUpdateResult> {
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: krId },
      include: {
        proofs: {
          orderBy: {
            uploadedAt: 'desc'
          }
        },
        goal: {
          include: {
            owner: true
          }
        }
      }
    });

    if (!keyResult) {
      throw new ForbiddenException('key result not found');
    }

    const canAccess = await this.canAccessEmployee(actor, keyResult.goal.owner);
    if (!canAccess) {
      throw new ForbiddenException('leader scope mismatch');
    }

    const updated = await this.prisma.keyResult.update({
      where: { id: krId },
      data: {
        reviewScore: score,
        reviewComment: comment,
        reviewedAt: new Date(),
        reviewedByUserId: actor.id
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
        reviewScore: keyResult.reviewScore,
        reviewComment: keyResult.reviewComment
      },
      after: this.toKeyResultRecord(updated)
    };
  }

  async getRanking(
    actor: AuthUser,
    year: number,
    quarter: number,
    reviewGroupId?: string | null,
    employeeId?: string | null
  ): Promise<LeaderRankingRecord> {
    const employees = await this.getVisibleEmployees(actor, year, quarter);
    const reviewGroups = this.listVisibleReviewGroups(actor, employees);
    const selectedReviewGroup = this.pickReviewGroup(reviewGroups, reviewGroupId);

    if (!selectedReviewGroup) {
      return {
        year,
        quarter,
        reviewGroups,
        selectedReviewGroup: null,
        seatSummary: [],
        ranking: [],
        selectedEmployee: null
      };
    }

    const filteredEmployees = employees.filter((employee) => employee.reviewGroupId === selectedReviewGroup.id);
    const quotas = await this.prisma.reviewGradeQuota.findMany({
      where: {
        reviewGroupId: selectedReviewGroup.id
      },
      orderBy: {
        gradeCode: 'asc'
      }
    });

    const ranking = this.assignGrades(
      filteredEmployees
        .map((employee) => this.toRankingEntry(employee))
        .sort((left, right) => compareRanking(left, right)),
      quotas.map((quota) => ({
        gradeCode: quota.gradeCode,
        seatCount: quota.seatCount
      }))
    );

    const seatSummary = buildSeatSummary(quotas, ranking);
    const selectedEmployeeRecord = this.pickRankingEmployee(filteredEmployees, ranking, employeeId);

    return {
      year,
      quarter,
      reviewGroups,
      selectedReviewGroup,
      seatSummary,
      ranking,
      selectedEmployee: selectedEmployeeRecord
    };
  }

  private async getVisibleEmployees(actor: AuthUser, year: number, quarter: number): Promise<EmployeeWithQuarterData[]> {
    const where = await this.buildVisibleEmployeeWhere(actor);

    return this.prisma.user.findMany({
      where,
      orderBy: {
        createdAt: 'asc'
      },
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

  private async canAccessEmployee(actor: AuthUser, employee: User): Promise<boolean> {
    const where = await this.buildVisibleEmployeeWhere(actor);
    const count = await this.prisma.user.count({
      where: {
        ...where,
        id: employee.id
      }
    });
    return count > 0;
  }

  private pickEmployee(employees: EmployeeWithQuarterData[], employeeId?: string | null) {
    if (!employees.length) {
      return null;
    }

    if (employeeId) {
      const matched = employees.find((employee) => employee.id === employeeId);
      if (matched) {
        return matched;
      }
    }

    return employees[0];
  }

  private pickGoal(goals: GoalWithQuarterData[], goalId?: string | null) {
    if (!goals.length) {
      return null;
    }

    if (goalId) {
      const matched = goals.find((goal: GoalWithQuarterData) => goal.id === goalId);
      if (matched) {
        return matched;
      }
    }

    return goals[0];
  }

  private listVisibleReviewGroups(actor: AuthUser, employees: EmployeeWithQuarterData[]): LeaderReviewGroupRecord[] {
    if (actor.role === 'group-leader') {
      const groups = new Map<string, LeaderReviewGroupRecord>();
      for (const employee of employees) {
        if (employee.reviewGroupId && employee.reviewGroup) {
          groups.set(employee.reviewGroupId, {
            id: employee.reviewGroupId,
            name: employee.reviewGroup.name
          });
        }
      }
      return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name));
    }

    const groups = new Map<string, LeaderReviewGroupRecord>();
    for (const employee of employees) {
      if (employee.reviewGroupId && employee.reviewGroup) {
        groups.set(employee.reviewGroupId, {
          id: employee.reviewGroupId,
          name: employee.reviewGroup.name
        });
      }
    }
    return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  private pickReviewGroup(reviewGroups: LeaderReviewGroupRecord[], reviewGroupId?: string | null) {
    if (!reviewGroups.length) {
      return null;
    }

    if (reviewGroupId) {
      const matched = reviewGroups.find((reviewGroup) => reviewGroup.id === reviewGroupId);
      if (matched) {
        return matched;
      }
    }

    return reviewGroups[0];
  }

  private pickRankingEmployee(
    employees: EmployeeWithQuarterData[],
    ranking: LeaderRankingEntryRecord[],
    employeeId?: string | null
  ): LeaderRankingSelectedEmployeeRecord | null {
    if (!employees.length) {
      return null;
    }

    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
    const selectedRankingEntry =
      (employeeId ? ranking.find((entry) => entry.employeeId === employeeId) : null) ??
      ranking[0] ??
      this.toRankingEntry(employees[0]);
    const employee = employeeMap.get(selectedRankingEntry.employeeId);

    if (!employee) {
      return null;
    }

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      sectionName: employee.section?.name ?? null,
      reviewGroupName: employee.reviewGroup?.name ?? null,
      quarterScore: selectedRankingEntry.quarterScore,
      currentGrade: selectedRankingEntry.currentGrade,
      goalBreakdown: employee.ownedGoals.map((goal) => this.toRankingGoalBreakdown(goal))
    };
  }

  private toEmployeeSummary(employee: EmployeeWithQuarterData): LeaderEmployeeSummaryRecord {
    const keyResults = employee.ownedGoals.flatMap((goal) => goal.keyResults);
    const scoredKeyResults = keyResults.filter((keyResult) => keyResult.reviewScore !== null);

    return {
      id: employee.id,
      name: employee.name,
      sectionName: employee.section?.name ?? null,
      reviewGroupId: employee.reviewGroupId ?? null,
      reviewGroupName: employee.reviewGroup?.name ?? null,
      goalCount: employee.ownedGoals.length,
      keyResultCount: keyResults.length,
      scoredKeyResultCount: scoredKeyResults.length,
      proofCount: keyResults.reduce((sum, keyResult) => sum + keyResult.proofs.length, 0),
      quarterScore: scoreFromKeyResults(keyResults),
      status: statusFromCounts(scoredKeyResults.length, keyResults.length)
    };
  }

  private toGoalSummary(goal: GoalWithQuarterData): LeaderGoalSummaryRecord {
    const keyResults = goal.keyResults;
    const scoredKeyResultCount = keyResults.filter((keyResult) => keyResult.reviewScore !== null).length;

    return {
      id: goal.id,
      code: goal.code,
      name: goal.name,
      description: goal.description,
      status: goal.status,
      totalPoints: goal.totalPoints,
      keyResultCount: keyResults.length,
      scoredKeyResultCount,
      proofCount: keyResults.reduce((sum, keyResult) => sum + keyResult.proofs.length, 0),
      currentScore: scoreFromKeyResults(keyResults)
    };
  }

  private toGoalDetail(goal: GoalWithQuarterData): LeaderGoalDetailRecord {
    const summary = this.toGoalSummary(goal);
    return {
      ...summary,
      keyResults: goal.keyResults.map((keyResult) => this.toKeyResultRecord(keyResult))
    };
  }

  private toKeyResultRecord(
    keyResult: KeyResultWithProofs
  ): LeaderKeyResultRecord {
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

  private toProofRecord(
    proof: KeyResultWithProofs['proofs'][number]
  ): LeaderProofRecord {
    return {
      id: proof.id,
      fileName: proof.fileName,
      fileUrl: proof.fileUrl,
      fileSize: proof.fileSize,
      note: proof.note,
      uploadedAt: proof.uploadedAt.toISOString()
    };
  }

  private toRankingEntry(employee: EmployeeWithQuarterData): LeaderRankingEntryRecord {
    const summary = this.toEmployeeSummary(employee);
    return {
      employeeId: summary.id,
      employeeName: summary.name,
      sectionName: summary.sectionName,
      quarterScore: summary.quarterScore,
      goalCount: summary.goalCount,
      keyResultCount: summary.keyResultCount,
      scoredKeyResultCount: summary.scoredKeyResultCount,
      proofCount: summary.proofCount,
      currentGrade: null,
      status: summary.status
    };
  }

  private toRankingGoalBreakdown(goal: GoalWithQuarterData): LeaderRankingGoalBreakdownRecord {
    return {
      goalId: goal.id,
      goalCode: goal.code,
      goalName: goal.name,
      goalScore: scoreFromKeyResults(goal.keyResults),
      keyResultCount: goal.keyResults.length,
      scoredKeyResultCount: goal.keyResults.filter((keyResult) => keyResult.reviewScore !== null).length,
      keyResults: goal.keyResults.map((keyResult) => ({
        keyResultId: keyResult.id,
        code: keyResult.code,
        name: keyResult.name,
        points: keyResult.points,
        reviewScore: keyResult.reviewScore
      }))
    };
  }

  private assignGrades(
    ranking: LeaderRankingEntryRecord[],
    quotas: Array<{ gradeCode: string; seatCount: number }>
  ): LeaderRankingEntryRecord[] {
    const eligible = ranking.filter((entry) => entry.scoredKeyResultCount > 0);
    let cursor = 0;

    for (const gradeCode of REVIEW_GRADE_CODES) {
      const quota = quotas.find((entry) => entry.gradeCode === gradeCode);
      const seatCount = quota?.seatCount ?? 0;

      for (let index = 0; index < seatCount && cursor < eligible.length; index += 1) {
        eligible[cursor].currentGrade = gradeCode;
        cursor += 1;
      }
    }

    return ranking;
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

function statusFromCounts(scoredKeyResultCount: number, keyResultCount: number) {
  if (keyResultCount === 0 || scoredKeyResultCount === 0) {
    return 'pending';
  }

  if (scoredKeyResultCount < keyResultCount) {
    return 'in-progress';
  }

  return 'completed';
}

function compareRanking(left: LeaderRankingEntryRecord, right: LeaderRankingEntryRecord) {
  const leftScore = left.quarterScore ?? -1;
  const rightScore = right.quarterScore ?? -1;

  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  return left.employeeName.localeCompare(right.employeeName);
}

function buildSeatSummary(
  quotas: Array<{ gradeCode: string; seatCount: number }>,
  ranking: LeaderRankingEntryRecord[]
): LeaderSeatSummaryRecord[] {
  return REVIEW_GRADE_CODES.map((gradeCode) => ({
    gradeCode,
    seatCount: quotas.find((entry) => entry.gradeCode === gradeCode)?.seatCount ?? 0,
    occupiedCount: ranking.filter((entry) => entry.currentGrade === gradeCode).length
  }));
}
