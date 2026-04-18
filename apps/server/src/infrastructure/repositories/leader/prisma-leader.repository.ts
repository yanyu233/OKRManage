import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { REVIEW_GRADE_CODES } from '../../../shared/constants/review-grade-codes';
import { DomainValidationError } from '../../../shared/errors/domain-validation.error';
import { AuthUser } from '../../../shared/types/auth-user';
import { RuntimeConfigService } from '../../../modules/config/runtime-config.service';
import { buildProofDownloadUrl, buildProofPreviewUrl } from '../../../shared/proof/proof-links';
import {
  AllOkrEmployeeRecord,
  AllOkrGoalRecord,
  AllOkrKeyResultRecord,
  AllOkrRecord,
  LeaderAnnualPublicNoticeRecord,
  LeaderAnnualQuarterScoreRecord,
  LeaderAnnualRankingEntryRecord,
  LeaderAnnualRankingRecord,
  LeaderAnnualRankingSelectedEmployeeRecord,
  LeaderBulkScoreInput,
  LeaderBulkScoreResult,
  LeaderEmployeeSummaryRecord,
  LeaderGoalDetailRecord,
  LeaderKnowledgeBaseRecord,
  LeaderKnowledgeAssetFileRecord,
  LeaderKnowledgeDownloadRecord,
  LeaderKnowledgeEntryRecord,
  LeaderKnowledgeEntryUpdateInput,
  LeaderKnowledgeEntryUpdateResult,
  LeaderManualKnowledgeAssetCreateInput,
  LeaderPublicNoticeEntryRecord,
  LeaderGoalSummaryRecord,
  LeaderKeyResultRecord,
  LeaderProofKnowledgeToggleResult,
  LeaderProofRecord,
  LeaderQuarterlyPublicNoticeRecord,
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
    department: true;
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
type KnowledgeAssetWithUploader = Prisma.KnowledgeAssetGetPayload<{
  include: {
    uploadedBy: true;
  };
}>;
type LeaderScoringScope = {
  allowAll: boolean;
  sectionIds: Set<string>;
  reviewGroupIds: Set<string>;
};
type KnowledgeManagementScope = {
  enabled: boolean;
  sectionIds: Set<string>;
  reviewGroupIds: Set<string>;
};

@Injectable()
export class PrismaLeaderRepository implements LeaderRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeConfig: RuntimeConfigService
  ) {}

  async getAllOkr(year: number, quarter: number): Promise<AllOkrRecord> {
    const employees = await this.getVisibleEmployees(year, quarter);

    return {
      year,
      quarter,
      employees: employees.map((employee) => this.toAllOkrEmployeeRecord(employee))
    };
  }

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
    const selectedEmployeeCanManageKnowledge = canManageKnowledge(actor, selectedEmployee, scoringScope);
    const goalSummaries = selectedEmployee.ownedGoals.map((goal) => this.toGoalSummary(goal, selectedEmployeeCanScore));
    const selectedGoal = this.pickGoal(selectedEmployee.ownedGoals, goalId);

    return {
      year,
      quarter,
      employees: employeeSummaries,
      selectedEmployee: this.toEmployeeSummary(selectedEmployee, selectedEmployeeCanScore),
      goals: goalSummaries,
      selectedGoal: selectedGoal
        ? this.toGoalDetail(selectedGoal, selectedEmployeeCanScore, selectedEmployeeCanManageKnowledge)
        : null,
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

      if (!isGoalReviewEditableStatus(keyResult.goal.status)) {
        throw new DomainValidationError('only goals pending review or completed can be scored');
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
    const appliedScore = input.score ?? null;

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

      if (!isGoalReviewEditableStatus(entry.goal.status)) {
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

      if (!input.allowMissingProofs && entry.keyResult.proofs.length === 0) {
        skipped.push({
          keyResultId: entry.keyResult.id,
          reason: 'proof-missing'
        });
        return false;
      }

      if (appliedScore !== null && appliedScore > entry.keyResult.points) {
        skipped.push({
          keyResultId: entry.keyResult.id,
          reason: 'score-exceeds-points'
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
              reviewScore: appliedScore ?? entry.keyResult.points,
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

          if (!goal || !isGoalReviewEditableStatus(goal.status)) {
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
    const proof = await this.requireProofWithRelations(proofId);
    await this.assertKnowledgeManagementAccess(actor, proof);

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
      after: this.toProofRecord(updated, true)
    };
  }

  async getKnowledgeBase(actor: AuthUser): Promise<LeaderKnowledgeBaseRecord> {
    const knowledgeManagementScope = await this.resolveKnowledgeManagementScope(actor);
    const [proofs, manualAssets] = await Promise.all([
      this.prisma.proof.findMany({
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
      }),
      this.prisma.knowledgeAsset.findMany({
        orderBy: [{ updatedAt: 'desc' }, { uploadedAt: 'desc' }],
        include: {
          uploadedBy: true
        }
      })
    ]);

    return {
      entries: [
        ...proofs.map((proof) =>
          this.toKnowledgeEntryRecord(proof, this.canManageKnowledgeProof(proof, knowledgeManagementScope))
        ),
        ...manualAssets.map((asset) =>
          this.toManualKnowledgeEntryRecord(
            asset,
            this.canManageManualKnowledgeAsset(actor, asset, knowledgeManagementScope)
          )
        )
      ].sort(compareKnowledgeEntry)
    };
  }

  async updateKnowledgeProof(
    actor: AuthUser,
    proofId: string,
    input: LeaderKnowledgeEntryUpdateInput
  ): Promise<LeaderKnowledgeEntryUpdateResult> {
    const proof = await this.requireProofWithRelations(proofId);
    await this.assertKnowledgeManagementAccess(actor, proof);

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
        entryType: 'proof',
        fileName: proof.fileName,
        note: proof.note,
        storageKey: proof.fileUrl
      },
      after: this.toKnowledgeEntryRecord(updated, true),
      previousStorageKey: input.storageKey ? proof.fileUrl : null
    };
  }

  async createManualKnowledgeAsset(
    actor: AuthUser,
    input: LeaderManualKnowledgeAssetCreateInput
  ): Promise<LeaderKnowledgeEntryRecord> {
    this.assertManualKnowledgeManagementRole(actor);

    const asset = await this.prisma.knowledgeAsset.create({
      data: {
        fileName: input.fileName,
        fileUrl: input.storageKey,
        fileSize: input.fileSize,
        note: input.note,
        uploadedByUserId: actor.id
      },
      include: {
        uploadedBy: true
      }
    });

    return this.toManualKnowledgeEntryRecord(asset, true);
  }

  async updateManualKnowledgeAsset(
    actor: AuthUser,
    assetId: string,
    input: LeaderKnowledgeEntryUpdateInput
  ): Promise<LeaderKnowledgeEntryUpdateResult> {
    const asset = await this.requireKnowledgeAssetWithUploader(assetId);
    await this.assertManualKnowledgeManagementAccess(actor, asset);
    const nextFileName = input.fileName ?? asset.fileName;
    const nextStorageKey = input.storageKey ?? asset.fileUrl;
    const nextFileSize = input.fileSize ?? asset.fileSize;

    const updated = await this.prisma.knowledgeAsset.update({
      where: { id: assetId },
      data: {
        fileName: nextFileName,
        fileUrl: nextStorageKey,
        fileSize: nextFileSize,
        note: input.note
      },
      include: {
        uploadedBy: true
      }
    });

    return {
      before: {
        id: asset.id,
        entryType: 'manual',
        fileName: asset.fileName,
        note: asset.note,
        storageKey: asset.fileUrl
      },
      after: this.toManualKnowledgeEntryRecord(updated, this.canManageManualKnowledgeAsset(actor, updated)),
      previousStorageKey: input.storageKey ? asset.fileUrl : null
    };
  }

  async getKnowledgeEntryDownloads(actor: AuthUser, entryKeys: string[]): Promise<LeaderKnowledgeDownloadRecord[]> {
    void actor;
    const normalizedEntries = Array.from(
      new Map(
        entryKeys
          .map((entryKey) => parseKnowledgeEntryKey(entryKey))
          .filter((entry): entry is { entryType: 'proof' | 'manual'; id: string } => entry !== null)
          .map((entry) => [buildKnowledgeEntryKey(entry.entryType, entry.id), entry])
      ).values()
    );
    if (!normalizedEntries.length) {
      return [];
    }

    const proofIds = normalizedEntries.filter((entry) => entry.entryType === 'proof').map((entry) => entry.id);
    const manualIds = normalizedEntries.filter((entry) => entry.entryType === 'manual').map((entry) => entry.id);
    const [proofs, manualAssets] = await Promise.all([
      proofIds.length
        ? this.prisma.proof.findMany({
            where: {
              id: {
                in: proofIds
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
          })
        : Promise.resolve([]),
      manualIds.length
        ? this.prisma.knowledgeAsset.findMany({
            where: {
              id: {
                in: manualIds
              }
            },
            include: {
              uploadedBy: true
            }
          })
        : Promise.resolve([])
    ]);
    const proofById = new Map(proofs.map((proof) => [proof.id, proof]));
    const manualById = new Map(manualAssets.map((asset) => [asset.id, asset]));

    return normalizedEntries.map((entry) => {
      if (entry.entryType === 'proof') {
        const proof = proofById.get(entry.id);
        if (!proof) {
          throw new NotFoundException('knowledge proof not found');
        }

        return this.toKnowledgeDownloadRecord(proof);
      }

      const asset = manualById.get(entry.id);
      if (!asset) {
        throw new NotFoundException('knowledge asset not found');
      }

      return this.toManualKnowledgeDownloadRecord(asset);
    });
  }

  async getManualKnowledgeAssetDownload(actor: AuthUser, assetId: string): Promise<LeaderKnowledgeAssetFileRecord> {
    void actor;
    return this.getManualKnowledgeAssetStorage(assetId);
  }

  async getManualKnowledgeAssetStorage(assetId: string): Promise<LeaderKnowledgeAssetFileRecord> {
    const asset = await this.prisma.knowledgeAsset.findUnique({
      where: { id: assetId }
    });

    if (!asset) {
      throw new NotFoundException('knowledge asset not found');
    }

    return {
      id: asset.id,
      fileName: asset.fileName,
      storageKey: asset.fileUrl
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

  async getQuarterlyPublicNotice(
    actor: AuthUser,
    year: number,
    quarter: number,
    reviewGroupId?: string | null
  ): Promise<LeaderQuarterlyPublicNoticeRecord> {
    void actor;
    const employees = await this.getVisibleEmployees(year, quarter);
    const filteredEmployees = reviewGroupId
      ? employees.filter((employee) => employee.reviewGroupId === reviewGroupId)
      : employees;

    return {
      year,
      quarter,
      departmentName: resolveSingleDepartmentName(filteredEmployees),
      reviewGroupName: resolveSingleReviewGroupName(filteredEmployees),
      entries: await this.buildQuarterlyPublicNoticeEntries(filteredEmployees)
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

  async getAnnualPublicNotice(
    actor: AuthUser,
    year: number,
    sectionId?: string | null,
    reviewGroupId?: string | null
  ): Promise<LeaderAnnualPublicNoticeRecord> {
    void actor;
    const employees = filterAnnualRankingEmployees(await this.getVisibleEmployeesForYear(year), {
      sectionId,
      reviewGroupId
    });

    return {
      year,
      departmentName: resolveSingleDepartmentName(employees),
      entries: await this.buildAnnualPublicNoticeEntries(employees)
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
        department: true,
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
        department: true,
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

  private async buildQuarterlyPublicNoticeEntries(
    employees: EmployeeWithQuarterData[]
  ): Promise<LeaderPublicNoticeEntryRecord[]> {
    const gradesByEmployeeId = await this.buildQuarterlyGradeLookup(employees);

    return employees
      .map((employee) => {
        const score = scoreFromKeyResults(employee.ownedGoals.flatMap((goal) => goal.keyResults));
        return this.toPublicNoticeEntry(
          employee,
          gradesByEmployeeId.get(employee.id) || scoreToNoticeLabel(score)
        );
      })
      .sort(comparePublicNoticeEntry);
  }

  private async buildAnnualPublicNoticeEntries(
    employees: EmployeeWithQuarterData[]
  ): Promise<LeaderPublicNoticeEntryRecord[]> {
    const gradesByEmployeeId = await this.buildAnnualGradeLookup(employees);

    return employees
      .map((employee) => {
        const annualScore = this.toAnnualRankingEntry(employee).annualScore;
        return this.toPublicNoticeEntry(
          employee,
          gradesByEmployeeId.get(employee.id) || scoreToNoticeLabel(annualScore / 4)
        );
      })
      .sort(comparePublicNoticeEntry);
  }

  private async buildQuarterlyGradeLookup(employees: EmployeeWithQuarterData[]) {
    const quotasByReviewGroupId = await this.getReviewGroupQuotaMap(employees);
    const grades = new Map<string, string>();

    for (const [reviewGroupId, groupEmployees] of groupEmployeesByReviewGroup(employees)) {
      const ranking = this.assignGrades(
        groupEmployees.map((employee) => this.toRankingEntry(employee)).sort(compareRanking),
        quotasByReviewGroupId.get(reviewGroupId) ?? []
      );

      for (const entry of ranking) {
        grades.set(entry.employeeId, gradeCodeToNoticeLabel(entry.currentGrade) ?? '');
      }
    }

    return grades;
  }

  private async buildAnnualGradeLookup(employees: EmployeeWithQuarterData[]) {
    const quotasByReviewGroupId = await this.getReviewGroupQuotaMap(employees);
    const grades = new Map<string, string>();

    for (const [reviewGroupId, groupEmployees] of groupEmployeesByReviewGroup(employees)) {
      const ranking = assignAnnualGrades(
        groupEmployees.map((employee) => this.toAnnualRankingEntry(employee)).sort(compareAnnualRanking),
        quotasByReviewGroupId.get(reviewGroupId) ?? []
      );

      for (const entry of ranking) {
        grades.set(entry.employeeId, gradeCodeToNoticeLabel(entry.currentGrade) ?? '');
      }
    }

    return grades;
  }

  private async getReviewGroupQuotaMap(employees: EmployeeWithQuarterData[]) {
    const reviewGroupIds = Array.from(
      new Set(employees.map((employee) => employee.reviewGroupId).filter((reviewGroupId): reviewGroupId is string => Boolean(reviewGroupId)))
    );

    if (!reviewGroupIds.length) {
      return new Map<string, Array<{ gradeCode: string; seatCount: number }>>();
    }

    const quotas = await this.prisma.reviewGradeQuota.findMany({
      where: {
        reviewGroupId: {
          in: reviewGroupIds
        }
      },
      orderBy: [{ reviewGroupId: 'asc' }, { gradeCode: 'asc' }]
    });

    const quotasByReviewGroupId = new Map<string, Array<{ gradeCode: string; seatCount: number }>>();
    for (const quota of quotas) {
      const current = quotasByReviewGroupId.get(quota.reviewGroupId) ?? [];
      current.push({
        gradeCode: quota.gradeCode,
        seatCount: quota.seatCount
      });
      quotasByReviewGroupId.set(quota.reviewGroupId, current);
    }

    return quotasByReviewGroupId;
  }

  private toPublicNoticeEntry(employee: EmployeeWithQuarterData, resultLabel: string): LeaderPublicNoticeEntryRecord {
    return {
      employeeId: employee.id,
      employeeNo: employee.employeeNo ?? null,
      employeeName: employee.name,
      departmentName: employee.department?.name ?? null,
      sectionName: employee.section?.name ?? null,
      positionName: employee.positionName ?? null,
      reviewGroupName: employee.reviewGroup?.name ?? null,
      resultLabel,
    };
  }

  private toEmployeeSummary(employee: EmployeeWithQuarterData, canScore: boolean): LeaderEmployeeSummaryRecord {
    const keyResults = employee.ownedGoals.flatMap((goal) => goal.keyResults);
    const scoredKeyResults = keyResults.filter((keyResult) => keyResult.reviewScore !== null);
    const missingProofKeyResultCount = keyResults.filter((keyResult) => keyResult.proofs.length === 0).length;

    return {
      id: employee.id,
      name: employee.name,
      positionName: employee.positionName ?? null,
      departmentName: employee.department?.name ?? null,
      sectionId: employee.sectionId ?? null,
      sectionName: employee.section?.name ?? null,
      reviewGroupId: employee.reviewGroupId ?? null,
      reviewGroupName: employee.reviewGroup?.name ?? null,
      canScore,
      goalCount: employee.ownedGoals.length,
      keyResultCount: keyResults.length,
      scoredKeyResultCount: scoredKeyResults.length,
      missingProofKeyResultCount,
      proofCount: keyResults.reduce((sum, keyResult) => sum + keyResult.proofs.length, 0),
      quarterScore: scoreFromKeyResults(keyResults),
      status: statusFromCounts(scoredKeyResults.length, keyResults.length)
    };
  }

  private toAllOkrEmployeeRecord(employee: EmployeeWithQuarterData): AllOkrEmployeeRecord {
    const keyResults = employee.ownedGoals.flatMap((goal) => goal.keyResults);
    const completedKeyResultCount = keyResults.filter((keyResult) => keyResult.completionState === 'completed').length;
    const scoredKeyResultCount = keyResults.filter((keyResult) => keyResult.reviewScore !== null).length;
    const missingProofKeyResultCount = keyResults.filter((keyResult) => keyResult.proofs.length === 0).length;

    return {
      id: employee.id,
      name: employee.name,
      positionName: employee.positionName ?? null,
      departmentName: employee.department?.name ?? null,
      sectionId: employee.sectionId ?? null,
      sectionName: employee.section?.name ?? null,
      reviewGroupId: employee.reviewGroupId ?? null,
      reviewGroupName: employee.reviewGroup?.name ?? null,
      goalCount: employee.ownedGoals.length,
      keyResultCount: keyResults.length,
      completedKeyResultCount,
      scoredKeyResultCount,
      missingProofKeyResultCount,
      proofCount: keyResults.reduce((sum, keyResult) => sum + keyResult.proofs.length, 0),
      quarterScore: scoreFromKeyResults(keyResults),
      status: statusFromCounts(scoredKeyResultCount, keyResults.length),
      goals: employee.ownedGoals.map((goal) => this.toAllOkrGoalRecord(goal))
    };
  }

  private toGoalSummary(goal: GoalWithQuarterData, canScore: boolean): LeaderGoalSummaryRecord {
    const keyResults = goal.keyResults;
    const scoredKeyResultCount = keyResults.filter((keyResult) => keyResult.reviewScore !== null).length;
    const goalCanScore = canScore && isGoalReviewEditableStatus(goal.status);
    const missingProofKeyResultCount = keyResults.filter((keyResult) => keyResult.proofs.length === 0).length;

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
      missingProofKeyResultCount,
      proofCount: keyResults.reduce((sum, keyResult) => sum + keyResult.proofs.length, 0),
      currentScore: scoreFromKeyResults(keyResults)
    };
  }

  private toAllOkrGoalRecord(goal: GoalWithQuarterData): AllOkrGoalRecord {
    const completedKeyResultCount = goal.keyResults.filter((keyResult) => keyResult.completionState === 'completed').length;
    const scoredKeyResultCount = goal.keyResults.filter((keyResult) => keyResult.reviewScore !== null).length;
    const missingProofKeyResultCount = goal.keyResults.filter((keyResult) => keyResult.proofs.length === 0).length;

    return {
      id: goal.id,
      code: goal.code,
      name: goal.name,
      description: goal.description,
      status: goal.status,
      totalPoints: goal.totalPoints,
      isTemplateGoal: goal.importedTemplates.length > 0,
      keyResultCount: goal.keyResults.length,
      completedKeyResultCount,
      scoredKeyResultCount,
      missingProofKeyResultCount,
      proofCount: goal.keyResults.reduce((sum, keyResult) => sum + keyResult.proofs.length, 0),
      currentScore: scoreFromKeyResults(goal.keyResults),
      keyResults: goal.keyResults.map((keyResult) => this.toAllOkrKeyResultRecord(keyResult))
    };
  }

  private toGoalDetail(
    goal: GoalWithQuarterData,
    canScore: boolean,
    canManageKnowledge = false
  ): LeaderGoalDetailRecord {
    const summary = this.toGoalSummary(goal, canScore);
    return {
      ...summary,
      keyResults: goal.keyResults.map((keyResult) =>
        this.toKeyResultRecord(keyResult, summary.canScore, canManageKnowledge)
      )
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
          reviewScore: keyResult.reviewScore,
          proofCount: keyResult.proofs.length,
          hasProofs: keyResult.proofs.length > 0,
          isProofMissing: keyResult.proofs.length === 0
        }))
      }))
    };
  }

  private toKeyResultRecord(
    keyResult: KeyResultWithProofs,
    canScore = true,
    canManageKnowledge = false
  ): LeaderKeyResultRecord {
    const latestProof = keyResult.proofs[0] ?? null;

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
      hasProofs: keyResult.proofs.length > 0,
      isProofMissing: keyResult.proofs.length === 0,
      proofCount: keyResult.proofs.length,
      latestProofUploadedAt: latestProof?.uploadedAt.toISOString() ?? null,
      proofs: keyResult.proofs.map((proof) => this.toProofRecord(proof, canManageKnowledge))
    };
  }

  private toAllOkrKeyResultRecord(keyResult: KeyResultWithProofs): AllOkrKeyResultRecord {
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
      latestProofUploadedAt: latestProof?.uploadedAt.toISOString() ?? null
    };
  }

  private toProofRecord(
    proof: KeyResultWithProofs['proofs'][number],
    canManageKnowledge = false
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
      canManageKnowledge,
      uploadedAt: proof.uploadedAt.toISOString(),
      updatedAt: proof.updatedAt.toISOString()
    };
  }

  private toKnowledgeEntryRecord(
    proof: ProofWithRelations,
    canManageKnowledge = false
  ): LeaderKnowledgeEntryRecord {
    const owner = proof.keyResult.goal.owner;
    const base = this.toProofRecord(proof, canManageKnowledge);

    return {
      entryKey: buildKnowledgeEntryKey('proof', proof.id),
      entryType: 'proof',
      ...base,
      uploaderName: owner.name,
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

  private toManualKnowledgeEntryRecord(
    asset: KnowledgeAssetWithUploader,
    canManageKnowledge = false
  ): LeaderKnowledgeEntryRecord {
    const downloadUrl = `/leader/knowledge-base/assets/${asset.id}/download`;

    return {
      entryKey: buildKnowledgeEntryKey('manual', asset.id),
      entryType: 'manual',
      id: asset.id,
      fileName: asset.fileName,
      previewUrl: `/leader/knowledge-base/assets/${asset.id}/preview`,
      downloadUrl,
      fileUrl: downloadUrl,
      fileSize: asset.fileSize,
      note: asset.note,
      isKnowledge: true,
      canManageKnowledge,
      uploadedAt: asset.uploadedAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
      uploaderName: asset.uploadedBy.name,
      employeeId: null,
      employeeName: null,
      sectionName: null,
      reviewGroupName: null,
      goalId: null,
      goalCode: null,
      goalName: null,
      keyResultId: null,
      keyResultCode: null,
      keyResultName: null
    };
  }

  private toKnowledgeDownloadRecord(proof: ProofWithRelations): LeaderKnowledgeDownloadRecord {
    return {
      entryKey: buildKnowledgeEntryKey('proof', proof.id),
      entryType: 'proof',
      id: proof.id,
      fileName: proof.fileName,
      storageKey: proof.fileUrl,
      uploaderName: proof.keyResult.goal.owner.name,
      employeeName: proof.keyResult.goal.owner.name,
      goalCode: proof.keyResult.goal.code,
      goalName: proof.keyResult.goal.name,
      keyResultCode: proof.keyResult.code,
      keyResultName: proof.keyResult.name
    };
  }

  private toManualKnowledgeDownloadRecord(asset: KnowledgeAssetWithUploader): LeaderKnowledgeDownloadRecord {
    return {
      entryKey: buildKnowledgeEntryKey('manual', asset.id),
      entryType: 'manual',
      id: asset.id,
      fileName: asset.fileName,
      storageKey: asset.fileUrl,
      uploaderName: asset.uploadedBy.name,
      employeeName: asset.uploadedBy.name,
      goalCode: '自由上传',
      goalName: '知识文件',
      keyResultCode: '资料',
      keyResultName: asset.fileName
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
      sectionId: employee.sectionId,
      sectionName: employee.section?.name ?? null,
      reviewGroupId: employee.reviewGroupId,
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

  private async getScoringScope(actor: AuthUser): Promise<LeaderScoringScope> {
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

  private async resolveKnowledgeManagementScope(actor: AuthUser): Promise<KnowledgeManagementScope> {
    if (!hasAssignedRole(actor, ['section-leader', 'group-leader'])) {
      return {
        enabled: false,
        sectionIds: new Set<string>(),
        reviewGroupIds: new Set<string>()
      };
    }

    return {
      enabled: true,
      ...(await this.resolveKnowledgeBindingScope(actor.id))
    };
  }

  private canManageKnowledgeProof(proof: ProofWithRelations, scope: KnowledgeManagementScope) {
    return canManageKnowledgeWithScope(proof.keyResult.goal.owner, scope);
  }

  private canManageManualKnowledgeAsset(
    actor: Pick<AuthUser, 'id'>,
    asset: Pick<KnowledgeAssetWithUploader, 'uploadedByUserId'>,
    scope?: KnowledgeManagementScope
  ) {
    if (asset.uploadedByUserId === actor.id) {
      return true;
    }

    return scope?.enabled ?? false;
  }

  private async assertKnowledgeManagementAccess(actor: AuthUser, proof: ProofWithRelations) {
    const knowledgeManagementScope = await this.resolveKnowledgeManagementScope(actor);

    if (!this.canManageKnowledgeProof(proof, knowledgeManagementScope)) {
      throw new ForbiddenException('knowledge scope mismatch');
    }
  }

  private assertManualKnowledgeManagementRole(actor: AuthUser) {
    if (!hasAssignedRole(actor, ['section-leader', 'group-leader'])) {
      throw new ForbiddenException('knowledge editor role required');
    }
  }

  private async resolveKnowledgeBindingScope(actorUserId: string) {
    const [sectionBindings, groupBindings] = await this.prisma.$transaction([
      this.prisma.sectionLeaderBinding.findMany({
        where: {
          leaderUserId: actorUserId
        },
        select: {
          sectionId: true
        }
      }),
      this.prisma.groupLeaderBinding.findMany({
        where: {
          leaderUserId: actorUserId
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

  private async assertManualKnowledgeManagementAccess(actor: AuthUser, asset: KnowledgeAssetWithUploader) {
    const knowledgeManagementScope = await this.resolveKnowledgeManagementScope(actor);

    if (!this.canManageManualKnowledgeAsset(actor, asset, knowledgeManagementScope)) {
      throw new ForbiddenException('knowledge scope mismatch');
    }
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

  private async requireKnowledgeAssetWithUploader(assetId: string): Promise<KnowledgeAssetWithUploader> {
    const asset = await this.prisma.knowledgeAsset.findUnique({
      where: { id: assetId },
      include: {
        uploadedBy: true
      }
    });

    if (!asset) {
      throw new NotFoundException('knowledge asset not found');
    }

    return asset;
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

function filterAnnualRankingEmployees(
  employees: EmployeeWithQuarterData[],
  filters: { sectionId?: string | null; reviewGroupId?: string | null }
) {
  return employees.filter((employee) => {
    if (filters.sectionId && employee.sectionId !== filters.sectionId) {
      return false;
    }

    if (filters.reviewGroupId && employee.reviewGroupId !== filters.reviewGroupId) {
      return false;
    }

    return true;
  });
}

function buildKnowledgeEntryKey(entryType: 'proof' | 'manual', id: string) {
  return `${entryType}:${id}`;
}

function parseKnowledgeEntryKey(entryKey: string): { entryType: 'proof' | 'manual'; id: string } | null {
  const normalized = entryKey.trim();
  if (!normalized) {
    return null;
  }

  const delimiterIndex = normalized.indexOf(':');
  if (delimiterIndex <= 0) {
    return {
      entryType: 'proof',
      id: normalized
    };
  }

  const entryType = normalized.slice(0, delimiterIndex);
  const id = normalized.slice(delimiterIndex + 1).trim();
  if (!id || (entryType !== 'proof' && entryType !== 'manual')) {
    return null;
  }

  return {
    entryType,
    id
  };
}

function compareKnowledgeEntry(left: LeaderKnowledgeEntryRecord, right: LeaderKnowledgeEntryRecord) {
  const updatedDiff = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  if (updatedDiff !== 0) {
    return updatedDiff;
  }

  const uploadedDiff = new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime();
  if (uploadedDiff !== 0) {
    return uploadedDiff;
  }

  return left.fileName.localeCompare(right.fileName, 'zh-CN');
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

function assignAnnualGrades(
  ranking: LeaderAnnualRankingEntryRecord[],
  quotas: Array<{ gradeCode: string; seatCount: number }>
) {
  const entries = ranking.map((entry) => ({
    ...entry,
    currentGrade: null as string | null
  }));
  const eligible = entries.filter((entry) => entry.annualScore > 0);
  let cursor = 0;

  for (const gradeCode of REVIEW_GRADE_CODES) {
    const quota = quotas.find((entry) => entry.gradeCode === gradeCode);
    const seatCount = quota?.seatCount ?? 0;

    for (let index = 0; index < seatCount && cursor < eligible.length; index += 1) {
      eligible[cursor].currentGrade = gradeCode;
      cursor += 1;
    }
  }

  return entries;
}

function groupEmployeesByReviewGroup(employees: EmployeeWithQuarterData[]) {
  const groups = new Map<string, EmployeeWithQuarterData[]>();

  for (const employee of employees) {
    const reviewGroupId = employee.reviewGroupId ?? '__ungrouped__';
    const current = groups.get(reviewGroupId) ?? [];
    current.push(employee);
    groups.set(reviewGroupId, current);
  }

  return groups;
}

function resolveSingleDepartmentName(employees: EmployeeWithQuarterData[]) {
  const departmentNames = Array.from(
    new Set(employees.map((employee) => employee.department?.name?.trim()).filter((name): name is string => Boolean(name)))
  );

  return departmentNames.length === 1 ? departmentNames[0] : null;
}

function resolveSingleReviewGroupName(employees: EmployeeWithQuarterData[]) {
  const reviewGroupNames = Array.from(
    new Set(employees.map((employee) => employee.reviewGroup?.name?.trim()).filter((name): name is string => Boolean(name)))
  );

  return reviewGroupNames.length === 1 ? reviewGroupNames[0] : null;
}

function comparePublicNoticeEntry(left: LeaderPublicNoticeEntryRecord, right: LeaderPublicNoticeEntryRecord) {
  const collator = new Intl.Collator('zh-CN');
  return collator.compare(left.employeeName, right.employeeName);
}

function gradeCodeToNoticeLabel(gradeCode: string | null | undefined) {
  switch (gradeCode) {
    case 'A+':
    case 'A':
    case 'B':
    case 'C':
    case 'D':
      return gradeCode;
    default:
      return null;
  }
}

function scoreToNoticeLabel(score: number | null) {
  if (score === null || !Number.isFinite(score) || score <= 0) {
    return '';
  }

  if (score >= 90) {
    return 'A+';
  }
  if (score >= 80) {
    return 'A';
  }
  if (score >= 70) {
    return 'B';
  }
  if (score >= 60) {
    return 'C';
  }
  return 'D';
}

function canScoreEmployee(
  employee: Pick<User, 'sectionId' | 'reviewGroupId'>,
  scope: LeaderScoringScope
) {
  if (scope.allowAll) {
    return true;
  }

  return (
    (employee.sectionId ? scope.sectionIds.has(employee.sectionId) : false) ||
    (employee.reviewGroupId ? scope.reviewGroupIds.has(employee.reviewGroupId) : false)
  );
}

function canManageKnowledge(
  actor: Pick<AuthUser, 'role' | 'roles'>,
  employee: Pick<User, 'sectionId' | 'reviewGroupId'>,
  scope: LeaderScoringScope
) {
  if (!hasAssignedRole(actor, ['section-leader', 'group-leader'])) {
    return false;
  }

  return canScoreEmployee(employee, scope);
}

function canManageKnowledgeWithScope(
  employee: Pick<User, 'sectionId' | 'reviewGroupId'>,
  scope: KnowledgeManagementScope
) {
  if (!scope.enabled) {
    return false;
  }

  return (
    (employee.sectionId ? scope.sectionIds.has(employee.sectionId) : false) ||
    (employee.reviewGroupId ? scope.reviewGroupIds.has(employee.reviewGroupId) : false)
  );
}

function hasAssignedRole(
  actor: Pick<AuthUser, 'role' | 'roles'>,
  roleCodes: string[]
) {
  if (roleCodes.includes(actor.role)) {
    return true;
  }

  return actor.roles.some((assignment) => roleCodes.includes(assignment.role));
}

function isGoalReviewEditableStatus(status: string) {
  return status === 'pending-review' || status === 'completed';
}

function compareGoalCode(left: string, right: string) {
  return extractGoalCodeIndex(left) - extractGoalCodeIndex(right) || left.localeCompare(right);
}

function extractGoalCodeIndex(code: string) {
  const match = /^O(\d+)$/i.exec(code.trim());
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}
