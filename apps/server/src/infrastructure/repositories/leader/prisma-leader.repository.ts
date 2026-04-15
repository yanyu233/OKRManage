import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { REVIEW_GRADE_CODES } from '../../../shared/constants/review-grade-codes';
import { DomainValidationError } from '../../../shared/errors/domain-validation.error';
import { AuthUser } from '../../../shared/types/auth-user';
import { RuntimeConfigService } from '../../../modules/config/runtime-config.service';
import { buildProofDownloadUrl, buildProofPreviewUrl } from '../../../shared/proof/proof-links';
import {
  LeaderAnnualQuarterScoreRecord,
  LeaderAnnualRankingEntryRecord,
  LeaderAnnualRankingRecord,
  LeaderAnnualRankingSelectedEmployeeRecord,
  LeaderBulkScoreInput,
  LeaderBulkScoreResult,
  LeaderEmployeeSummaryRecord,
  LeaderGoalDetailRecord,
  LeaderKnowledgeBaseRecord,
  LeaderKnowledgeProofDownloadRecord,
  LeaderKnowledgeEntryRecord,
  LeaderKnowledgeProofUpdateInput,
  LeaderKnowledgeProofUpdateResult,
  LeaderGoalSummaryRecord,
  LeaderKeyResultRecord,
  LeaderProofKnowledgeToggleResult,
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
type ProofWithRelations = Prisma.ProofGetPayload<{
  include: {
    keyResult: {
      include: {
        goal: {
          include: {
            owner: {
              include: {
                section: true;
                reviewGroup: true;
              };
            };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class PrismaLeaderRepository implements LeaderRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeConfig: RuntimeConfigService
  ) {}

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
        selectedGoal: null,
        bulkCatalog: employees.map((employee) => this.toBulkCatalogEmployee(employee, canScoreEmployee(employee, scoringScope)))
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
      selectedGoal: selectedGoal ? this.toGoalDetail(selectedGoal, selectedEmployeeCanScore) : null,
      bulkCatalog: employees.map((employee) => this.toBulkCatalogEmployee(employee, canScoreEmployee(employee, scoringScope)))
    };
  }

  async updateKeyResultScore(actor: AuthUser, krId: string, score: number, comment: string | null): Promise<LeaderScoreUpdateResult> {
    return this.prisma.$transaction(async (transaction) => {
      const keyResult = await transaction.keyResult.findUnique({
        where: { id: krId },
        include: {
          proofs: {
            orderBy: {
              uploadedAt: 'desc'
            }
          },
          goal: {
            include: {
              owner: true,
              keyResults: {
                select: {
                  id: true,
                  reviewScore: true
                }
              }
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

      if (keyResult.goal.status !== 'pending-review') {
        throw new DomainValidationError('only goals pending review can be scored');
      }

      if (score < 0 || score > keyResult.points) {
        throw new DomainValidationError('score exceeds key result points');
      }

      const updated = await transaction.keyResult.update({
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

      const hasPendingScore = keyResult.goal.keyResults.some(
        (entry) => entry.id === krId ? score === null : entry.reviewScore === null
      );
      if (!hasPendingScore) {
        await transaction.goal.update({
          where: { id: keyResult.goalId },
          data: {
            status: 'completed'
          }
        });
      }

      return {
        before: {
          id: keyResult.id,
          reviewScore: keyResult.reviewScore,
          reviewComment: keyResult.reviewComment
        },
        after: this.toKeyResultRecord(updated, true)
      };
    });
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

      if (entry.goal.status !== 'pending-review') {
        skipped.push({
          keyResultId: entry.keyResult.id,
          reason: 'goal-status-blocked'
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

      if (entry.keyResult.scoreType === 'subjective') {
        skipped.push({
          keyResultId: entry.keyResult.id,
          reason: 'subjective-only'
        });
        return false;
      }

      return true;
    });

    if (updatable.length > 0) {
      await this.prisma.$transaction(async (transaction) => {
        for (const entry of updatable) {
          await transaction.keyResult.update({
            where: { id: entry.keyResult.id },
            data: {
              reviewScore: entry.keyResult.points,
              reviewComment: input.comment,
              reviewedAt: new Date(),
              reviewedByUserId: actor.id
            }
          });
        }

        const affectedGoalIds = Array.from(new Set(updatable.map((entry) => entry.goal.id)));
        for (const goalId of affectedGoalIds) {
          const goal = await transaction.goal.findUnique({
            where: { id: goalId },
            select: {
              status: true,
              keyResults: {
                select: {
                  reviewScore: true
                }
              }
            }
          });

          if (!goal || goal.status !== 'pending-review') {
            continue;
          }

          if (goal.keyResults.length > 0 && goal.keyResults.every((entry) => entry.reviewScore !== null)) {
            await transaction.goal.update({
              where: { id: goalId },
              data: {
                status: 'completed'
              }
            });
          }
        }
      });
    }

    return {
      updatedCount: updatable.length,
      skippedCount: skipped.length,
      skipped
    };
  }

  async updateProofKnowledge(
    actor: AuthUser,
    proofId: string,
    isKnowledge: boolean
  ): Promise<LeaderProofKnowledgeToggleResult> {
    void actor;
    const proof = await this.requireProofWithRelations(proofId);

    const updated = await this.prisma.proof.update({
      where: { id: proofId },
      data: {
        isKnowledge
      }
    });

    return {
      before: {
        id: proof.id,
        isKnowledge: proof.isKnowledge
      },
      after: this.toProofRecord(updated)
    };
  }

  async getKnowledgeBase(actor: AuthUser): Promise<LeaderKnowledgeBaseRecord> {
    void actor;
    const proofs = await this.prisma.proof.findMany({
      where: {
        isKnowledge: true
      },
      orderBy: [{ updatedAt: 'desc' }, { uploadedAt: 'desc' }],
      include: {
        keyResult: {
          include: {
            goal: {
              include: {
                owner: {
                  include: {
                    section: true,
                    reviewGroup: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return {
      entries: proofs.map((proof) => this.toKnowledgeEntryRecord(proof))
    };
  }

  async updateKnowledgeProof(
    actor: AuthUser,
    proofId: string,
    input: LeaderKnowledgeProofUpdateInput
  ): Promise<LeaderKnowledgeProofUpdateResult> {
    void actor;
    const proof = await this.requireProofWithRelations(proofId);

    if (!proof.isKnowledge) {
      throw new DomainValidationError('only knowledge proofs can be updated here');
    }

    const nextFileName = input.fileName ?? proof.fileName;
    const nextStorageKey = input.storageKey ?? proof.fileUrl;
    const nextFileSize = input.fileSize ?? proof.fileSize;

    const updated = await this.prisma.proof.update({
      where: { id: proofId },
      data: {
        fileName: nextFileName,
        fileUrl: nextStorageKey,
        fileSize: nextFileSize,
        note: input.note
      },
      include: {
        keyResult: {
          include: {
            goal: {
              include: {
                owner: {
                  include: {
                    section: true,
                    reviewGroup: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return {
      before: {
        id: proof.id,
        fileName: proof.fileName,
        note: proof.note,
        storageKey: proof.fileUrl
      },
      after: this.toKnowledgeEntryRecord(updated),
      previousStorageKey: input.storageKey ? proof.fileUrl : null
    };
  }

  async getKnowledgeProofDownloads(actor: AuthUser, proofIds: string[]): Promise<LeaderKnowledgeProofDownloadRecord[]> {
    void actor;
    const normalizedIds = Array.from(new Set(proofIds.map((proofId) => proofId.trim()).filter((proofId) => proofId.length > 0)));
    if (!normalizedIds.length) {
      return [];
    }

    const proofs = await this.prisma.proof.findMany({
      where: {
        id: {
          in: normalizedIds
        },
        isKnowledge: true
      },
      include: {
        keyResult: {
          include: {
            goal: {
              include: {
                owner: {
                  include: {
                    section: true,
                    reviewGroup: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const proofById = new Map(proofs.map((proof) => [proof.id, proof]));

    return normalizedIds.map((proofId) => {
      const proof = proofById.get(proofId);
      if (!proof) {
        throw new NotFoundException('knowledge proof not found');
      }

      return this.toKnowledgeDownloadRecord(proof);
    });
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

  async getAnnualRanking(actor: AuthUser, year: number, employeeId?: string | null): Promise<LeaderAnnualRankingRecord> {
    const employees = await this.getVisibleEmployeesForYear(year);
    const ranking = employees.map((employee) => this.toAnnualRankingEntry(employee)).sort(compareAnnualRanking);
    const selectedEmployee = this.pickAnnualRankingEmployee(ranking, employeeId);

    return {
      year,
      ranking,
      selectedEmployee
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

  private async getVisibleEmployeesForYear(year: number): Promise<EmployeeWithQuarterData[]> {
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
            year
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
        ownedGoals: employee.ownedGoals
          .slice()
          .sort((left, right) => left.quarter - right.quarter || compareGoalCode(left.code, right.code))
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

  private pickAnnualRankingEmployee(
    ranking: LeaderAnnualRankingEntryRecord[],
    employeeId?: string | null
  ): LeaderAnnualRankingSelectedEmployeeRecord | null {
    if (!ranking.length) {
      return null;
    }

    if (employeeId) {
      const matched = ranking.find((entry) => entry.employeeId === employeeId);
      if (matched) {
        return matched;
      }
    }

    return ranking[0];
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
    const goalCanScore = canScore && goal.status === 'pending-review';

    return {
      id: goal.id,
      code: goal.code,
      name: goal.name,
      description: goal.description,
      status: goal.status,
      totalPoints: goal.totalPoints,
      canScore: goalCanScore,
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
      keyResults: goal.keyResults.map((keyResult) => this.toKeyResultRecord(keyResult, summary.canScore))
    };
  }

  private toBulkCatalogEmployee(employee: EmployeeWithQuarterData, canScore: boolean) {
    return {
      id: employee.id,
      name: employee.name,
      sectionId: employee.sectionId ?? null,
      sectionName: employee.section?.name ?? null,
      reviewGroupId: employee.reviewGroupId ?? null,
      reviewGroupName: employee.reviewGroup?.name ?? null,
      canScore,
      goals: employee.ownedGoals.map((goal) => ({
        id: goal.id,
        code: goal.code,
        name: goal.name,
        isTemplateGoal: goal.importedTemplates.length > 0,
        keyResults: goal.keyResults.map((keyResult) => ({
          id: keyResult.id,
          code: keyResult.code,
          name: keyResult.name,
          points: keyResult.points,
          scoreType: keyResult.scoreType,
          reviewScore: keyResult.reviewScore
        }))
      }))
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
      scoreType: keyResult.scoreType,
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
      isKnowledge: proof.isKnowledge,
      uploadedAt: proof.uploadedAt.toISOString(),
      updatedAt: proof.updatedAt.toISOString()
    };
  }

  private toKnowledgeEntryRecord(proof: ProofWithRelations): LeaderKnowledgeEntryRecord {
    const owner = proof.keyResult.goal.owner;
    const base = this.toProofRecord(proof);

    return {
      ...base,
      employeeId: owner.id,
      employeeName: owner.name,
      sectionName: owner.section?.name ?? null,
      reviewGroupName: owner.reviewGroup?.name ?? null,
      goalId: proof.keyResult.goal.id,
      goalCode: proof.keyResult.goal.code,
      goalName: proof.keyResult.goal.name,
      keyResultId: proof.keyResult.id,
      keyResultCode: proof.keyResult.code,
      keyResultName: proof.keyResult.name
    };
  }

  private toKnowledgeDownloadRecord(proof: ProofWithRelations): LeaderKnowledgeProofDownloadRecord {
    return {
      id: proof.id,
      fileName: proof.fileName,
      storageKey: proof.fileUrl,
      employeeName: proof.keyResult.goal.owner.name,
      goalCode: proof.keyResult.goal.code,
      goalName: proof.keyResult.goal.name,
      keyResultCode: proof.keyResult.code,
      keyResultName: proof.keyResult.name
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

  private toAnnualRankingEntry(employee: EmployeeWithQuarterData): LeaderAnnualRankingEntryRecord {
    const quarterScores = buildAnnualQuarterScores(employee.ownedGoals);
    const annualScore = Number(quarterScores.reduce((sum, item) => sum + item.score, 0).toFixed(1));

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      sectionName: employee.section?.name ?? null,
      reviewGroupName: employee.reviewGroup?.name ?? null,
      annualScore,
      quarterScores
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
    if (actor.role === 'department-head') {
      return {
        allowAll: true,
        sectionIds: new Set<string>(),
        reviewGroupIds: new Set<string>()
      };
    }

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
      allowAll: false,
      sectionIds: new Set(sectionBindings.map((binding) => binding.sectionId)),
      reviewGroupIds: new Set(groupBindings.map((binding) => binding.reviewGroupId))
    };
  }

  private async requireProofWithRelations(proofId: string): Promise<ProofWithRelations> {
    const proof = await this.prisma.proof.findUnique({
      where: { id: proofId },
      include: {
        keyResult: {
          include: {
            goal: {
              include: {
                owner: {
                  include: {
                    section: true,
                    reviewGroup: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!proof) {
      throw new NotFoundException('proof not found');
    }

    return proof;
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

function compareAnnualRanking(left: LeaderAnnualRankingEntryRecord, right: LeaderAnnualRankingEntryRecord) {
  if (left.annualScore !== right.annualScore) {
    return right.annualScore - left.annualScore;
  }

  return left.employeeName.localeCompare(right.employeeName);
}

function buildAnnualQuarterScores(goals: GoalWithQuarterData[]): LeaderAnnualQuarterScoreRecord[] {
  return [1, 2, 3, 4].map((quarter) => ({
    quarter,
    score: scoreFromGoals(goals.filter((goal) => goal.quarter === quarter))
  }));
}

function scoreFromGoals(goals: GoalWithQuarterData[]) {
  const total = goals.reduce((sum, goal) => sum + goal.keyResults.reduce((goalSum, keyResult) => goalSum + (keyResult.reviewScore ?? 0), 0), 0);
  return Number(total.toFixed(1));
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
  scope: { allowAll: boolean; sectionIds: Set<string>; reviewGroupIds: Set<string> }
) {
  if (scope.allowAll) {
    return true;
  }

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
