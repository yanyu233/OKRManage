import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { REVIEW_GRADE_CODES } from '../../../shared/constants/review-grade-codes';
import { AuthUser } from '../../../shared/types/auth-user';
import {
  LeaderBulkScoreInput,
  LeaderBulkScoreResult,
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
    const employees = await this.getVisibleEmployees(year, quarter);
    const scoringScope = await this.getScoringScope(actor);
    const employeeSummaries = employees.map((employee) => this.toEmployeeSummary(employee, canScoreEmployee(employee, scoringScope)));
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

    const selectedEmployeeCanScore = canScoreEmployee(selectedEmployee, scoringScope);
    const goalSummaries = selectedEmployee.ownedGoals.map((goal) => this.toGoalSummary(goal, selectedEmployeeCanScore));
    const selectedGoal = this.pickGoal(selectedEmployee.ownedGoals, goalId);

    return {
      year,
      quarter,
      employees: employeeSummaries,
      selectedEmployee: this.toEmployeeSummary(selectedEmployee, selectedEmployeeCanScore),
      goals: goalSummaries,
      selectedGoal: selectedGoal ? this.toGoalDetail(selectedGoal, selectedEmployeeCanScore) : null
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

    const canScore = await this.canScoreEmployee(actor, keyResult.goal.owner);
    if (!canScore) {
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

  private async canScoreEmployee(actor: AuthUser, employee: User) {
    return canScoreEmployee(employee, await this.getScoringScope(actor));
  }

  async batchScore(actor: AuthUser, input: LeaderBulkScoreInput): Promise<LeaderBulkScoreResult> {
    const employees = await this.getVisibleEmployees(input.year, input.quarter);
    const scoringScope = await this.getScoringScope(actor);
    const employeeIdFilter = new Set(input.employeeIds ?? []);
    const goalIdFilter = new Set(input.goalIds ?? []);
    const keyResultIdFilter = new Set(input.keyResultIds ?? []);

    const filteredEmployees = employees.filter((employee) => {
      if (input.sectionId && employee.sectionId !== input.sectionId) {
        return false;
      }

      if (input.reviewGroupId && employee.reviewGroupId !== input.reviewGroupId) {
        return false;
      }

      if (employeeIdFilter.size > 0 && !employeeIdFilter.has(employee.id)) {
        return false;
      }

      return true;
    });

    const candidates = filteredEmployees.flatMap((employee) =>
      employee.ownedGoals
        .filter((goal) => {
          if (goalIdFilter.size > 0 && !goalIdFilter.has(goal.id)) {
            return false;
          }

          if (input.excludeTemplateGoals && goal.importedTemplates.length > 0) {
            return false;
          }

          return true;
        })
        .flatMap((goal) =>
          goal.keyResults
            .filter((keyResult) => keyResultIdFilter.size === 0 || keyResultIdFilter.has(keyResult.id))
            .map((keyResult) => ({
              employee,
              goal,
              keyResult
            }))
        )
    );

    const uniqueCandidates = Array.from(new Map(candidates.map((entry) => [entry.keyResult.id, entry])).values());
    const skipped: LeaderBulkScoreResult['skipped'] = [];
    const updatable = uniqueCandidates.filter((entry) => {
      if (!canScoreEmployee(entry.employee, scoringScope)) {
        skipped.push({
          keyResultId: entry.keyResult.id,
          reason: 'out-of-scope'
        });
        return false;
      }

      if (!input.overwriteExisting && entry.keyResult.reviewScore !== null) {
        skipped.push({
          keyResultId: entry.keyResult.id,
          reason: 'already-scored'
        });
        return false;
      }

      return true;
    });

    if (updatable.length > 0) {
      await this.prisma.$transaction(
        updatable.map((entry) =>
          this.prisma.keyResult.update({
            where: { id: entry.keyResult.id },
            data: {
              reviewScore: input.score,
              reviewComment: input.comment,
              reviewedAt: new Date(),
              reviewedByUserId: actor.id
            }
          })
        )
      );
    }

    return {
      updatedCount: updatable.length,
      skippedCount: skipped.length,
      skipped
    };
  }

  async getRanking(
    actor: AuthUser,
    year: number,
    quarter: number,
    reviewGroupId?: string | null,
    employeeId?: string | null
  ): Promise<LeaderRankingRecord> {
    const employees = await this.getVisibleEmployees(year, quarter);
    const reviewGroups = await this.listVisibleReviewGroups();
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

  private async getVisibleEmployees(year: number, quarter: number): Promise<EmployeeWithQuarterData[]> {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        roleAssignments: {
          some: {
            roleCode: 'employee',
            isEnabled: true
          }
        }
      },
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
    }).then((employees) =>
      employees.map((employee) => ({
        ...employee,
        ownedGoals: employee.ownedGoals.slice().sort((left, right) => compareGoalCode(left.code, right.code))
      }))
    );
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

  private async listVisibleReviewGroups(): Promise<LeaderReviewGroupRecord[]> {
    const reviewGroups = await this.prisma.reviewGroup.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    return reviewGroups.map((reviewGroup) => ({
      id: reviewGroup.id,
      name: reviewGroup.name
    }));
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

  private toEmployeeSummary(employee: EmployeeWithQuarterData, canScore: boolean): LeaderEmployeeSummaryRecord {
    const keyResults = employee.ownedGoals.flatMap((goal) => goal.keyResults);
    const scoredKeyResults = keyResults.filter((keyResult) => keyResult.reviewScore !== null);

    return {
      id: employee.id,
      name: employee.name,
      sectionId: employee.sectionId ?? null,
      sectionName: employee.section?.name ?? null,
      reviewGroupId: employee.reviewGroupId ?? null,
      reviewGroupName: employee.reviewGroup?.name ?? null,
      canScore,
      goalCount: employee.ownedGoals.length,
      keyResultCount: keyResults.length,
      scoredKeyResultCount: scoredKeyResults.length,
      proofCount: keyResults.reduce((sum, keyResult) => sum + keyResult.proofs.length, 0),
      quarterScore: scoreFromKeyResults(keyResults),
      status: statusFromCounts(scoredKeyResults.length, keyResults.length)
    };
  }

  private toGoalSummary(goal: GoalWithQuarterData, canScore: boolean): LeaderGoalSummaryRecord {
    const keyResults = goal.keyResults;
    const scoredKeyResultCount = keyResults.filter((keyResult) => keyResult.reviewScore !== null).length;

    return {
      id: goal.id,
      code: goal.code,
      name: goal.name,
      description: goal.description,
      status: goal.status,
      totalPoints: goal.totalPoints,
      canScore,
      isTemplateGoal: goal.importedTemplates.length > 0,
      keyResultCount: keyResults.length,
      scoredKeyResultCount,
      proofCount: keyResults.reduce((sum, keyResult) => sum + keyResult.proofs.length, 0),
      currentScore: scoreFromKeyResults(keyResults)
    };
  }

  private toGoalDetail(goal: GoalWithQuarterData, canScore: boolean): LeaderGoalDetailRecord {
    const summary = this.toGoalSummary(goal, canScore);
    return {
      ...summary,
      keyResults: goal.keyResults.map((keyResult) => this.toKeyResultRecord(keyResult, canScore))
    };
  }

  private toKeyResultRecord(
    keyResult: KeyResultWithProofs,
    canScore = true
  ): LeaderKeyResultRecord {
    return {
      id: keyResult.id,
      code: keyResult.code,
      name: keyResult.name,
      description: keyResult.description,
      points: keyResult.points,
      canScore,
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
      fileUrl: `/api/employee/proofs/${proof.id}/download`,
      fileSize: proof.fileSize,
      note: proof.note,
      uploadedAt: proof.uploadedAt.toISOString()
    };
  }

  private toRankingEntry(employee: EmployeeWithQuarterData): LeaderRankingEntryRecord {
    const summary = this.toEmployeeSummary(employee, false);
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

  private async getScoringScope(actor: AuthUser) {
    const [sectionBindings, groupBindings] = await Promise.all([
      this.prisma.sectionLeaderBinding.findMany({
        where: {
          leaderUserId: actor.id
        },
        select: {
          sectionId: true
        }
      }),
      this.prisma.groupLeaderBinding.findMany({
        where: {
          leaderUserId: actor.id
        },
        select: {
          reviewGroupId: true
        }
      })
    ]);

    return {
      sectionIds: new Set(sectionBindings.map((binding) => binding.sectionId)),
      reviewGroupIds: new Set(groupBindings.map((binding) => binding.reviewGroupId))
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

function canScoreEmployee(
  employee: Pick<User, 'sectionId' | 'reviewGroupId'>,
  scope: { sectionIds: Set<string>; reviewGroupIds: Set<string> }
) {
  return (
    (employee.sectionId ? scope.sectionIds.has(employee.sectionId) : false) ||
    (employee.reviewGroupId ? scope.reviewGroupIds.has(employee.reviewGroupId) : false)
  );
}

function compareGoalCode(left: string, right: string) {
  return extractGoalCodeIndex(left) - extractGoalCodeIndex(right) || left.localeCompare(right);
}

function extractGoalCodeIndex(code: string) {
  const match = /^O(\d+)$/i.exec(code.trim());
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}
