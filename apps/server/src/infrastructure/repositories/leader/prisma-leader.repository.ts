import { createHash } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { REVIEW_GRADE_CODES } from '../../../shared/constants/review-grade-codes';
import { DomainValidationError } from '../../../shared/errors/domain-validation.error';
import { AuthUser } from '../../../shared/types/auth-user';
import { RuntimeConfigService } from '../../../modules/config/runtime-config.service';
import {
  buildSubjectiveAverageLimitGroupKey,
  evaluateSubjectiveAverageLimit
} from '../../../modules/leader/subjective-average-limit';
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
  LeaderRankingTieBreakEmployeeRecord,
  LeaderRankingTieBreakMetricsRecord,
  LeaderRankingTieBreakSaveInput,
  LeaderRankingTieBreakStatusRecord,
  LeaderRankingTieGroupRecord,
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
    quarterParticipationExclusions: true;
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
type EmployeeWithAnnualData = Prisma.UserGetPayload<{
  include: {
    department: true;
    section: true;
    reviewGroup: true;
    quarterParticipationExclusions: true;
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
    historicalScores: true;
  };
}>;
type RankingTieBreakDecisionData = Prisma.RankingTieBreakDecisionGetPayload<Record<string, never>>;
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

type QuarterRankingCandidate = LeaderRankingEntryRecord & {
  reviewGroupId: string;
  reviewGroupName: string;
  tieBreakMetrics: LeaderRankingTieBreakMetricsRecord;
  tieGroupKey: string | null;
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

  async getAllOkr(actor: AuthUser, year: number, quarter: number): Promise<AllOkrRecord> {
    const employees = await this.getVisibleEmployees(year, quarter);
    const scoresVisible = this.canExposeQuarterScores(actor, employees);
    const visibleEmployees = scoresVisible ? employees : this.maskQuarterScoreEmployees(employees);

    return {
      year,
      quarter,
      scoresVisible,
      employees: visibleEmployees.map((employee) => this.toAllOkrEmployeeRecord(employee))
    };
  }

  async getWorkbench(
    actor: AuthUser,
    year: number,
    quarter: number,
    scoreType: 'objective' | 'subjective',
    employeeId?: string | null,
    goalId?: string | null
  ): Promise<LeaderWorkbenchRecord> {
    const employees = this.filterEmployeesByScoreType(await this.getVisibleEmployees(year, quarter), scoreType);
    const scoringScope = await this.getScoringScope(actor, scoreType);
    const scopedEmployees =
      scoreType === 'subjective' && !scoringScope.allowAll
        ? employees.filter((employee) => canScoreEmployee(employee, scoringScope))
        : employees;
    const employeeSummaries = scopedEmployees.map((employee) =>
      this.toEmployeeSummary(employee, canScoreEmployee(employee, scoringScope))
    );
    const selectedEmployee = this.pickEmployee(scopedEmployees, employeeId);

    if (!selectedEmployee) {
      return {
        year,
        quarter,
        scoreType,
        employees: employeeSummaries,
        selectedEmployee: null,
        goals: [],
        selectedGoal: null,
        bulkCatalog: scopedEmployees.map((employee) =>
          this.toBulkCatalogEmployee(employee, canScoreEmployee(employee, scoringScope))
        )
      };
    }

    const selectedEmployeeCanScore = canScoreEmployee(selectedEmployee, scoringScope);
    const selectedEmployeeCanManageKnowledge = canManageKnowledge(actor, selectedEmployee, scoringScope);
    const goalSummaries = selectedEmployee.ownedGoals.map((goal) => this.toGoalSummary(goal, selectedEmployeeCanScore));
    const selectedGoal = this.pickGoal(selectedEmployee.ownedGoals, goalId);

    return {
      year,
      quarter,
      scoreType,
      employees: employeeSummaries,
      selectedEmployee: this.toEmployeeSummary(selectedEmployee, selectedEmployeeCanScore),
      goals: goalSummaries,
      selectedGoal: selectedGoal
        ? this.toGoalDetail(selectedGoal, selectedEmployeeCanScore, selectedEmployeeCanManageKnowledge)
        : null,
      bulkCatalog: scopedEmployees.map((employee) =>
        this.toBulkCatalogEmployee(employee, canScoreEmployee(employee, scoringScope))
      )
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
              owner: {
                include: {
                  section: true
                }
              },
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

      const canScore = canScoreEmployee(keyResult.goal.owner, await this.getScoringScope(actor, keyResult.scoreType));
      if (!canScore) {
        throw new ForbiddenException('leader scope mismatch');
      }

      if (!isGoalReviewEditableStatus(keyResult.goal.status)) {
        throw new DomainValidationError('only goals pending review or completed can be scored');
      }

      if (score < 0 || score > keyResult.points) {
        throw new DomainValidationError('score exceeds key result points');
      }

      if (keyResult.scoreType === 'subjective') {
        await this.assertSubjectiveAverageLimit(transaction, {
          year: keyResult.goal.year,
          quarter: keyResult.goal.quarter,
          sectionId: keyResult.goal.owner.sectionId ?? null,
          sectionName: keyResult.goal.owner.section?.name ?? null,
          itemName: keyResult.name,
          points: keyResult.points,
          proposedScores: new Map([[keyResult.id, score]])
        });
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

  async batchScore(actor: AuthUser, input: LeaderBulkScoreInput): Promise<LeaderBulkScoreResult> {
    const employees = await this.getVisibleEmployees(input.year, input.quarter);
    const [objectiveScoringScope, subjectiveScoringScope] = await Promise.all([
      this.getScoringScope(actor, 'objective'),
      this.getScoringScope(actor, 'subjective')
    ]);
    const employeeIdFilter = new Set(input.employeeIds ?? []);
    const goalIdFilter = new Set(input.goalIds ?? []);
    const keyResultIdFilter = new Set(input.keyResultIds ?? []);
    const entryInputMap = new Map((input.entries ?? []).map((entry) => [entry.keyResultId, entry]));
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
            .filter((keyResult) =>
              entryInputMap.size > 0
                ? entryInputMap.has(keyResult.id)
                : keyResultIdFilter.size === 0 || keyResultIdFilter.has(keyResult.id)
            )
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
      const scoringScope = entry.keyResult.scoreType === 'subjective' ? subjectiveScoringScope : objectiveScoringScope;
      const requestedEntry = entryInputMap.get(entry.keyResult.id);
      const targetScore = requestedEntry?.score ?? appliedScore ?? entry.keyResult.points;

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

      if (
        entry.keyResult.scoreType === 'objective' &&
        !input.allowMissingProofs &&
        !isTemplateGoal(entry.goal) &&
        entry.keyResult.proofs.length === 0
      ) {
        skipped.push({
          keyResultId: entry.keyResult.id,
          reason: 'proof-missing'
        });
        return false;
      }

      if (targetScore > entry.keyResult.points) {
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
        await this.assertSubjectiveAverageLimitForBatch(transaction, input, updatable);

        for (const entry of updatable) {
          const requestedEntry = entryInputMap.get(entry.keyResult.id);
          await transaction.keyResult.update({
            where: { id: entry.keyResult.id },
            data: {
              reviewScore: requestedEntry?.score ?? appliedScore ?? entry.keyResult.points,
              reviewComment:
                requestedEntry && Object.prototype.hasOwnProperty.call(requestedEntry, 'comment')
                  ? requestedEntry.comment ?? null
                  : input.comment,
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

  private async assertSubjectiveAverageLimitForBatch(
    transaction: Prisma.TransactionClient,
    input: LeaderBulkScoreInput,
    entries: Array<{
      employee: EmployeeWithQuarterData;
      goal: GoalWithQuarterData;
      keyResult: KeyResultWithProofs;
    }>
  ) {
    const groupedProposedScores = new Map<
      string,
      {
        sectionId: string | null;
        sectionName: string | null;
        itemName: string;
        points: number;
        proposedScores: Map<string, number>;
      }
    >();
    const entryInputMap = new Map((input.entries ?? []).map((entry) => [entry.keyResultId, entry]));

    for (const entry of entries) {
      if (entry.keyResult.scoreType !== 'subjective') {
        continue;
      }

      const targetScore = entryInputMap.get(entry.keyResult.id)?.score ?? input.score ?? entry.keyResult.points;
      const groupKey = [
        entry.employee.sectionId ?? '__none__',
        buildSubjectiveAverageLimitGroupKey(entry.keyResult.name, entry.keyResult.points)
      ].join('::');
      const group =
        groupedProposedScores.get(groupKey) ??
        {
          sectionId: entry.employee.sectionId ?? null,
          sectionName: entry.employee.section?.name ?? null,
          itemName: entry.keyResult.name,
          points: entry.keyResult.points,
          proposedScores: new Map<string, number>()
        };

      group.proposedScores.set(entry.keyResult.id, targetScore);
      groupedProposedScores.set(groupKey, group);
    }

    for (const group of groupedProposedScores.values()) {
      await this.assertSubjectiveAverageLimit(transaction, {
        year: input.year,
        quarter: input.quarter,
        sectionId: group.sectionId,
        sectionName: group.sectionName,
        itemName: group.itemName,
        points: group.points,
        proposedScores: group.proposedScores
      });
    }
  }

  private async assertSubjectiveAverageLimit(
    transaction: Prisma.TransactionClient,
    input: {
      year: number;
      quarter: number;
      sectionId: string | null;
      sectionName: string | null;
      itemName: string;
      points: number;
      proposedScores: Map<string, number>;
    }
  ) {
    const currentScores = await transaction.keyResult.findMany({
      where: {
        scoreType: 'subjective',
        name: input.itemName,
        points: input.points,
        goal: {
          year: input.year,
          quarter: input.quarter,
          owner: {
            isActive: true,
            sectionId: input.sectionId,
            roleAssignments: {
              some: {
                roleCode: 'employee',
                isEnabled: true
              }
            },
            quarterParticipationExclusions: {
              none: {
                year: input.year,
                quarter: input.quarter
              }
            }
          }
        }
      },
      select: {
        id: true,
        reviewScore: true
      }
    });

    if (!currentScores.length) {
      return;
    }

    const evaluation = evaluateSubjectiveAverageLimit(
      input.points,
      currentScores.map((entry) => ({
        id: entry.id,
        score: entry.reviewScore
      })),
      input.proposedScores
    );

    if (!evaluation.exceeded) {
      return;
    }

    throw new DomainValidationError(
      `科室“${input.sectionName ?? '未分配科室'}”的主观项“${input.itemName}”平均分不能超过 ${evaluation.limitScore.toFixed(
        2
      )} 分，当前保存后将达到 ${evaluation.averageScore.toFixed(2)} 分`
    );
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

  async deleteManualKnowledgeAsset(actor: AuthUser, assetId: string) {
    const asset = await this.requireKnowledgeAssetWithUploader(assetId);
    await this.assertManualKnowledgeManagementAccess(actor, asset);

    await this.prisma.knowledgeAsset.delete({
      where: { id: assetId }
    });

    return {
      id: asset.id,
      fileName: asset.fileName,
      note: asset.note,
      storageKey: asset.fileUrl
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
    const scoresVisible = this.canExposeQuarterScores(actor, employees);
    const canManageTieBreaks = hasAssignedRole(actor, ['system-admin']);

    if (!selectedReviewGroup) {
      return {
        year,
        quarter,
        scoresVisible,
        canManageTieBreaks,
        reviewGroups,
        selectedReviewGroup: null,
        seatSummary: [],
        ranking: [],
        selectedEmployee: null,
        pendingTieGroups: []
      };
    }

    if (!scoresVisible) {
      return {
        year,
        quarter,
        scoresVisible,
        canManageTieBreaks,
        reviewGroups,
        selectedReviewGroup,
        seatSummary: [],
        ranking: [],
        selectedEmployee: null,
        pendingTieGroups: []
      };
    }

    const reviewGroupIds = reviewGroups.map((reviewGroup) => reviewGroup.id);
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
    const tieBreakDecisions = await this.prisma.rankingTieBreakDecision.findMany({
      where: {
        year,
        quarter,
        reviewGroupId: {
          in: reviewGroupIds
        }
      },
      orderBy: [{ reviewGroupId: 'asc' }, { groupKey: 'asc' }, { orderIndex: 'asc' }]
    });
    const tieBreakDecisionsByReviewGroupId = groupTieBreakDecisionsByReviewGroupId(tieBreakDecisions);

    let ranking: LeaderRankingEntryRecord[] = [];
    const pendingTieGroups: LeaderRankingTieGroupRecord[] = [];

    for (const reviewGroup of reviewGroups) {
      const groupEmployees = employees.filter((employee) => employee.reviewGroupId === reviewGroup.id);
      const analysis = this.buildQuarterlyRankingState({
        year,
        quarter,
        reviewGroupId: reviewGroup.id,
        reviewGroupName: reviewGroup.name,
        employees: groupEmployees,
        quotas: quotasByReviewGroupId.get(reviewGroup.id) ?? [],
        decisions: tieBreakDecisionsByReviewGroupId.get(reviewGroup.id) ?? []
      });

      if (reviewGroup.id === selectedReviewGroup.id) {
        ranking = analysis.ranking;
      }

      if (canManageTieBreaks) {
        pendingTieGroups.push(...analysis.pendingTieGroups);
      }
    }

    const seatSummary = buildSeatSummary(
      quotas.filter((quota) => quota.reviewGroupId === selectedReviewGroup.id),
      ranking
    );
    const filteredEmployees = employees.filter((employee) => employee.reviewGroupId === selectedReviewGroup.id);
    const selectedEmployeeRecord = this.pickRankingEmployee(filteredEmployees, ranking, employeeId);

    return {
      year,
      quarter,
      scoresVisible,
      canManageTieBreaks,
      reviewGroups,
      selectedReviewGroup,
      seatSummary,
      ranking,
      selectedEmployee: selectedEmployeeRecord,
      pendingTieGroups: pendingTieGroups.sort((left, right) => {
        const reviewGroupCompare = left.reviewGroupName.localeCompare(right.reviewGroupName, 'zh-CN');
        if (reviewGroupCompare !== 0) {
          return reviewGroupCompare;
        }

        return left.rankStart - right.rankStart;
      })
    };
  }

  async saveRankingTieBreakDecision(input: LeaderRankingTieBreakSaveInput): Promise<void> {
    const employees = await this.getVisibleEmployees(input.year, input.quarter);
    if (!areQuarterScoresPublished(employees)) {
      throw new DomainValidationError('quarterly ranking is not ready');
    }

    const reviewGroup = await this.prisma.reviewGroup.findUnique({
      where: { id: input.reviewGroupId }
    });
    if (!reviewGroup) {
      throw new NotFoundException('review group not found');
    }

    const quotas = await this.prisma.reviewGradeQuota.findMany({
      where: {
        reviewGroupId: input.reviewGroupId
      },
      orderBy: {
        gradeCode: 'asc'
      }
    });
    const decisions = await this.prisma.rankingTieBreakDecision.findMany({
      where: {
        year: input.year,
        quarter: input.quarter,
        reviewGroupId: input.reviewGroupId
      },
      orderBy: [{ groupKey: 'asc' }, { orderIndex: 'asc' }]
    });
    const analysis = this.buildQuarterlyRankingState({
      year: input.year,
      quarter: input.quarter,
      reviewGroupId: input.reviewGroupId,
      reviewGroupName: reviewGroup.name,
      employees: employees.filter((employee) => employee.reviewGroupId === input.reviewGroupId),
      quotas: quotas.map((quota) => ({
        gradeCode: quota.gradeCode,
        seatCount: quota.seatCount
      })),
      decisions
    });
    const targetTieGroup = analysis.pendingTieGroups.find((group) => group.groupKey === input.groupKey);
    if (!targetTieGroup) {
      throw new DomainValidationError('ranking tie group is not pending');
    }

    const orderedEmployeeIds = Array.from(
      new Set(input.orderedEmployeeIds.map((employeeId) => employeeId.trim()).filter((employeeId) => employeeId.length > 0))
    );
    const expectedEmployeeIds = targetTieGroup.employees.map((employee) => employee.employeeId);

    if (
      orderedEmployeeIds.length !== expectedEmployeeIds.length ||
      expectedEmployeeIds.some((employeeId) => !orderedEmployeeIds.includes(employeeId))
    ) {
      throw new DomainValidationError('invalid ranking tie break order');
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.rankingTieBreakDecision.deleteMany({
        where: {
          year: input.year,
          quarter: input.quarter,
          reviewGroupId: input.reviewGroupId,
          employeeId: {
            in: expectedEmployeeIds
          }
        }
      });

      await transaction.rankingTieBreakDecision.createMany({
        data: orderedEmployeeIds.map((employeeId, index) => ({
          year: input.year,
          quarter: input.quarter,
          reviewGroupId: input.reviewGroupId,
          groupKey: input.groupKey,
          employeeId,
          orderIndex: index,
          decidedByUserId: input.decidedByUserId
        }))
      });
    });
  }

  async getQuarterlyPublicNotice(
    actor: AuthUser,
    year: number,
    quarter: number,
    reviewGroupId?: string | null
  ): Promise<LeaderQuarterlyPublicNoticeRecord> {
    const employees = await this.getVisibleEmployees(year, quarter);
    if (!this.canExposeQuarterScores(actor, employees)) {
      throw new DomainValidationError('quarterly ranking is not ready');
    }

    const filteredEmployees = reviewGroupId
      ? employees.filter((employee) => employee.reviewGroupId === reviewGroupId)
      : employees;

    return {
      year,
      quarter,
      departmentName: resolveSingleDepartmentName(filteredEmployees),
      reviewGroupName: resolveSingleReviewGroupName(filteredEmployees),
      entries: await this.buildQuarterlyPublicNoticeEntries(year, quarter, filteredEmployees)
    };
  }

  async getAnnualRanking(actor: AuthUser, year: number, employeeId?: string | null): Promise<LeaderAnnualRankingRecord> {
    const employees = await this.getVisibleEmployeesForYear(year);
    const scoresVisible = this.canExposeAnnualScores(actor, employees);
    const ranking = scoresVisible
      ? employees.map((employee) => this.toAnnualRankingEntry(employee)).sort(compareAnnualRanking)
      : employees.map((employee) => this.toMaskedAnnualRankingEntry(employee)).sort(compareAnnualRankingIdentity);
    const selectedEmployee = this.pickAnnualRankingEmployee(ranking, employeeId);

    return {
      year,
      scoresVisible,
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
    const visibleEmployees = await this.getVisibleEmployeesForYear(year);
    if (!this.canExposeAnnualScores(actor, visibleEmployees)) {
      throw new DomainValidationError('annual ranking is not ready');
    }

    const employees = filterAnnualRankingEmployees(visibleEmployees, {
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
        quarterParticipationExclusions: {
          where: {
            year,
            quarter
          }
        },
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
      employees
        .filter((employee) => !isQuarterParticipationExcluded(employee))
        .map((employee) => ({
          ...employee,
          ownedGoals: employee.ownedGoals.slice().sort((left, right) => compareGoalCode(left.code, right.code))
        }))
    );
  }

  private async getVisibleEmployeesForYear(year: number): Promise<EmployeeWithAnnualData[]> {
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
        quarterParticipationExclusions: {
          where: {
            year
          }
        },
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
        },
        historicalScores: {
          where: {
            year
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

  private filterEmployeesByScoreType(
    employees: EmployeeWithQuarterData[],
    scoreType: 'objective' | 'subjective'
  ): EmployeeWithQuarterData[] {
    return employees.map((employee) => ({
      ...employee,
      ownedGoals: employee.ownedGoals
        .map((goal) => ({
          ...goal,
          keyResults: goal.keyResults.filter((keyResult) => keyResult.scoreType === scoreType)
        }))
        .filter((goal) => goal.keyResults.length > 0)
    }));
  }

  private maskQuarterScoreEmployees(employees: EmployeeWithQuarterData[]): EmployeeWithQuarterData[] {
    return employees.map((employee) => ({
      ...employee,
      ownedGoals: employee.ownedGoals.map((goal) => ({
        ...goal,
        keyResults: goal.keyResults.map((keyResult) => ({
          ...keyResult,
          reviewScore: null,
          reviewComment: null
        }))
      }))
    }));
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

    return employees.find((employee) => employee.ownedGoals.length > 0) ?? employees[0];
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
      tieBreakStatus: selectedRankingEntry.tieBreakStatus,
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
    year: number,
    quarter: number,
    employees: EmployeeWithQuarterData[]
  ): Promise<LeaderPublicNoticeEntryRecord[]> {
    const gradesByEmployeeId = await this.buildQuarterlyGradeLookup(year, quarter, employees);

    return employees
      .map((employee) => {
        const score = scoreFromKeyResults(employee.ownedGoals.flatMap((goal) => goal.keyResults));
        return this.toPublicNoticeEntry(
          employee,
          gradesByEmployeeId.get(employee.id) ?? scoreToNoticeLabel(score)
        );
      })
      .sort(comparePublicNoticeEntry);
  }

  private async buildAnnualPublicNoticeEntries(
    employees: EmployeeWithAnnualData[]
  ): Promise<LeaderPublicNoticeEntryRecord[]> {
    const gradesByEmployeeId = await this.buildAnnualGradeLookup(employees);

    return employees
      .map((employee) => {
        const annualScore = this.toAnnualRankingEntry(employee).annualScore ?? 0;
        return this.toPublicNoticeEntry(
          employee,
          gradesByEmployeeId.get(employee.id) || scoreToNoticeLabel(annualScore / 4)
        );
      })
      .sort(comparePublicNoticeEntry);
  }

  private async buildQuarterlyGradeLookup(year: number, quarter: number, employees: EmployeeWithQuarterData[]) {
    const quotasByReviewGroupId = await this.getReviewGroupQuotaMap(employees);
    const reviewGroupIds = Array.from(
      new Set(employees.map((employee) => employee.reviewGroupId).filter((reviewGroupId): reviewGroupId is string => Boolean(reviewGroupId)))
    );
    const reviewGroups = reviewGroupIds.length
      ? await this.prisma.reviewGroup.findMany({
          where: {
            id: {
              in: reviewGroupIds
            }
          },
          select: {
            id: true,
            name: true
          }
        })
      : [];
    const tieBreakDecisions = reviewGroupIds.length
      ? await this.prisma.rankingTieBreakDecision.findMany({
          where: {
            year,
            quarter,
            reviewGroupId: {
              in: reviewGroupIds
            }
          },
          orderBy: [{ reviewGroupId: 'asc' }, { groupKey: 'asc' }, { orderIndex: 'asc' }]
        })
      : [];
    const tieBreakDecisionsByReviewGroupId = groupTieBreakDecisionsByReviewGroupId(tieBreakDecisions);
    const grades = new Map<string, string>();

    for (const [reviewGroupId, groupEmployees] of groupEmployeesByReviewGroup(employees)) {
      const reviewGroupName =
        reviewGroups.find((reviewGroup) => reviewGroup.id === reviewGroupId)?.name ?? groupEmployees[0]?.reviewGroup?.name ?? '未分配评价组';
      const ranking = this.buildQuarterlyRankingState({
        year,
        quarter,
        reviewGroupId,
        reviewGroupName,
        employees: groupEmployees,
        quotas: quotasByReviewGroupId.get(reviewGroupId) ?? [],
        decisions: tieBreakDecisionsByReviewGroupId.get(reviewGroupId) ?? []
      }).ranking;

      for (const entry of ranking) {
        grades.set(entry.employeeId, gradeCodeToNoticeLabel(entry.currentGrade) ?? PENDING_REVIEW_GRADE_LABEL);
      }
    }

    return grades;
  }

  private async buildAnnualGradeLookup(employees: EmployeeWithAnnualData[]) {
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

  private async getReviewGroupQuotaMap(
    employees: Array<Pick<EmployeeWithQuarterData, 'reviewGroupId'> | Pick<EmployeeWithAnnualData, 'reviewGroupId'>>
  ) {
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
    const proofRequiredKeyResults = employee.ownedGoals
      .filter((goal) => !isTemplateGoal(goal))
      .flatMap((goal) => goal.keyResults);
    const missingProofKeyResultCount = proofRequiredKeyResults.filter((keyResult) => keyResult.proofs.length === 0).length;

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
    const proofRequiredKeyResults = employee.ownedGoals
      .filter((goal) => !isTemplateGoal(goal))
      .flatMap((goal) => goal.keyResults);
    const missingProofKeyResultCount = proofRequiredKeyResults.filter((keyResult) => keyResult.proofs.length === 0).length;

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
    const templateGoal = isTemplateGoal(goal);
    const missingProofKeyResultCount = templateGoal ? 0 : keyResults.filter((keyResult) => keyResult.proofs.length === 0).length;

    return {
      id: goal.id,
      code: goal.code,
      name: goal.name,
      description: goal.description,
      status: goal.status,
      totalPoints: keyResults.reduce((sum, keyResult) => sum + keyResult.points, 0),
      canScore: goalCanScore,
      isTemplateGoal: templateGoal,
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
    const templateGoal = isTemplateGoal(goal);
    const missingProofKeyResultCount = templateGoal ? 0 : goal.keyResults.filter((keyResult) => keyResult.proofs.length === 0).length;

    return {
      id: goal.id,
      code: goal.code,
      name: goal.name,
      description: goal.description,
      status: goal.status,
      totalPoints: goal.totalPoints,
      isTemplateGoal: templateGoal,
      keyResultCount: goal.keyResults.length,
      completedKeyResultCount,
      scoredKeyResultCount,
      missingProofKeyResultCount,
      proofCount: goal.keyResults.reduce((sum, keyResult) => sum + keyResult.proofs.length, 0),
      currentScore: scoreFromKeyResults(goal.keyResults),
      keyResults: goal.keyResults.map((keyResult) => this.toAllOkrKeyResultRecord(keyResult, templateGoal))
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
        this.toKeyResultRecord(keyResult, summary.canScore, canManageKnowledge, summary.isTemplateGoal)
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
      goals: employee.ownedGoals.map((goal) => {
        const templateGoal = isTemplateGoal(goal);

        return {
          id: goal.id,
          code: goal.code,
          name: goal.name,
          isTemplateGoal: templateGoal,
          keyResults: goal.keyResults.map((keyResult) => ({
            id: keyResult.id,
            code: keyResult.code,
            name: keyResult.name,
            points: keyResult.points,
            scoreType: keyResult.scoreType,
            reviewScore: keyResult.reviewScore,
            proofCount: keyResult.proofs.length,
            hasProofs: keyResult.proofs.length > 0,
            isProofMissing: !templateGoal && keyResult.proofs.length === 0
          }))
        };
      })
    };
  }

  private toKeyResultRecord(
    keyResult: KeyResultWithProofs,
    canScore = true,
    canManageKnowledge = false,
    suppressProofMissing = false
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
      isProofMissing: !suppressProofMissing && keyResult.proofs.length === 0,
      proofCount: keyResult.proofs.length,
      latestProofUploadedAt: latestProof?.uploadedAt.toISOString() ?? null,
      proofs: keyResult.proofs.map((proof) => this.toProofRecord(proof, canManageKnowledge))
    };
  }

  private toAllOkrKeyResultRecord(keyResult: KeyResultWithProofs, suppressProofMissing = false): AllOkrKeyResultRecord {
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
      isProofMissing: !suppressProofMissing && keyResult.proofs.length === 0,
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
      status: summary.status,
      tieBreakStatus: 'none'
    };
  }

  private toRankingTieBreakMetrics(employee: EmployeeWithQuarterData): LeaderRankingTieBreakMetricsRecord {
    const customGoalScore = Number(
      employee.ownedGoals
        .filter((goal) => goal.importedTemplates.length === 0)
        .reduce((sum, goal) => sum + (scoreFromKeyResults(goal.keyResults) ?? 0), 0)
        .toFixed(1)
    );
    const metrics: LeaderRankingTieBreakMetricsRecord = {
      customGoalScore,
      objectiveTaskScore: 0,
      workAttitudeScore: 0,
      workCapabilityScore: 0,
      innovationScore: 0,
      learningShareScore: 0
    };

    for (const goal of employee.ownedGoals) {
      for (const keyResult of goal.keyResults) {
        const score = keyResult.reviewScore ?? 0;
        switch (resolveQuarterRankingMetricKey(keyResult.name)) {
          case 'objectiveTaskScore':
            metrics.objectiveTaskScore = accumulateQuarterRankingMetric(metrics.objectiveTaskScore, score);
            break;
          case 'workAttitudeScore':
            metrics.workAttitudeScore = accumulateQuarterRankingMetric(metrics.workAttitudeScore, score);
            break;
          case 'workCapabilityScore':
            metrics.workCapabilityScore = accumulateQuarterRankingMetric(metrics.workCapabilityScore, score);
            break;
          case 'innovationScore':
            metrics.innovationScore = accumulateQuarterRankingMetric(metrics.innovationScore, score);
            break;
          case 'learningShareScore':
            metrics.learningShareScore = accumulateQuarterRankingMetric(metrics.learningShareScore, score);
            break;
          default:
            break;
        }
      }
    }

    return metrics;
  }

  private toAnnualRankingEntry(employee: EmployeeWithAnnualData): LeaderAnnualRankingEntryRecord {
    const quarterScores = buildAnnualQuarterScores(employee.ownedGoals, employee.historicalScores);
    const annualScore = Number(quarterScores.reduce((sum, item) => sum + (item.score ?? 0), 0).toFixed(1));

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

  private toMaskedAnnualRankingEntry(employee: EmployeeWithAnnualData): LeaderAnnualRankingEntryRecord {
    const entry = this.toAnnualRankingEntry(employee);

    return {
      ...entry,
      annualScore: null,
      quarterScores: entry.quarterScores.map((item) => ({
        ...item,
        score: null
      }))
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

  private buildQuarterlyRankingState(args: {
    year: number;
    quarter: number;
    reviewGroupId: string;
    reviewGroupName: string;
    employees: EmployeeWithQuarterData[];
    quotas: Array<{ gradeCode: string; seatCount: number }>;
    decisions: RankingTieBreakDecisionData[];
  }): {
    ranking: LeaderRankingEntryRecord[];
    pendingTieGroups: LeaderRankingTieGroupRecord[];
  } {
    const candidates = args.employees
      .map((employee) => {
        const entry = this.toRankingEntry(employee);
        const tieBreakMetrics = this.toRankingTieBreakMetrics(employee);
        return {
          ...entry,
          reviewGroupId: args.reviewGroupId,
          reviewGroupName: args.reviewGroupName,
          tieBreakMetrics,
          tieGroupKey: null
        } as QuarterRankingCandidate;
      })
      .sort(compareQuarterRankingCandidate);

    const eligible = candidates.filter((entry) => entry.scoredKeyResultCount > 0);
    const gradeByPosition = resolveQuarterRankingGradeByPosition(eligible.length, args.quotas);
    const decisionsByGroupKey = groupTieBreakDecisionsByGroupKey(args.decisions);
    const pendingTieGroups: LeaderRankingTieGroupRecord[] = [];

    let cursor = 0;
    while (cursor < eligible.length) {
      const groupEnd = findQuarterRankingTieGroupEnd(eligible, cursor);
      const group = eligible.slice(cursor, groupEnd + 1);

      if (group.length > 1) {
        const groupKey = buildQuarterRankingTieGroupKey({
          year: args.year,
          quarter: args.quarter,
          reviewGroupId: args.reviewGroupId,
          entries: group
        });
        for (const entry of group) {
          entry.tieGroupKey = groupKey;
        }

        const resolvedOrder = resolveQuarterRankingTieBreakOrder(group, decisionsByGroupKey.get(groupKey) ?? []);
        if (resolvedOrder) {
          eligible.splice(cursor, group.length, ...resolvedOrder);
          for (const entry of resolvedOrder) {
            entry.tieBreakStatus = 'resolved';
          }
        } else {
          const affectedGradeCodes = Array.from(
            new Set(
              gradeByPosition
                .slice(cursor, groupEnd + 1)
                .filter((gradeCode): gradeCode is string => Boolean(gradeCode))
            )
          );
          if (affectedGradeCodes.length > 0) {
            for (const entry of group) {
              entry.tieBreakStatus = 'pending';
            }
            pendingTieGroups.push({
              groupKey,
              reviewGroupId: args.reviewGroupId,
              reviewGroupName: args.reviewGroupName,
              rankStart: cursor + 1,
              rankEnd: groupEnd + 1,
              affectedGradeCodes,
              employees: group.map((entry) => ({
                employeeId: entry.employeeId,
                employeeName: entry.employeeName,
                sectionName: entry.sectionName,
                quarterScore: entry.quarterScore,
                currentGrade: null,
                tieBreakMetrics: entry.tieBreakMetrics
              }))
            });
          }
        }
      }

      cursor = groupEnd + 1;
    }

    eligible.forEach((entry, index) => {
      entry.currentGrade = entry.tieBreakStatus === 'pending' ? null : gradeByPosition[index] ?? null;
    });

    return {
      ranking: candidates.map((entry) => ({
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        sectionName: entry.sectionName,
        quarterScore: entry.quarterScore,
        goalCount: entry.goalCount,
        keyResultCount: entry.keyResultCount,
        scoredKeyResultCount: entry.scoredKeyResultCount,
        proofCount: entry.proofCount,
        currentGrade: entry.currentGrade,
        status: entry.status,
        tieBreakStatus: entry.tieBreakStatus
      })),
      pendingTieGroups
    };
  }

  private canExposeQuarterScores(actor: AuthUser, employees: EmployeeWithQuarterData[]) {
    if (hasAssignedRole(actor, ['system-admin'])) {
      return true;
    }

    return areQuarterScoresPublished(employees);
  }

  private canExposeAnnualScores(actor: AuthUser, employees: EmployeeWithAnnualData[]) {
    if (hasAssignedRole(actor, ['system-admin'])) {
      return true;
    }

    return areAnnualScoresPublished(employees);
  }

  private async getScoringScope(
    actor: AuthUser,
    scoreType: 'objective' | 'subjective'
  ): Promise<LeaderScoringScope> {
    if (hasAssignedRole(actor, ['system-admin'])) {
      return {
        allowAll: true,
        sectionIds: new Set<string>(),
        reviewGroupIds: new Set<string>()
      };
    }

    if (scoreType === 'subjective') {
      if (actor.role !== 'section-leader') {
        return {
          allowAll: false,
          sectionIds: new Set<string>(),
          reviewGroupIds: new Set<string>()
        };
      }

      const sectionBindings = await this.prisma.sectionLeaderBinding.findMany({
        where: {
          leaderUserId: actor.id
        },
        select: {
          sectionId: true
        }
      });

      return {
        allowAll: false,
        sectionIds: new Set(sectionBindings.map((binding) => binding.sectionId)),
        reviewGroupIds: new Set<string>()
      };
    }

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

function accumulateQuarterRankingMetric(current: number, next: number) {
  return Number((current + next).toFixed(1));
}

function areQuarterScoresPublished(employees: EmployeeWithQuarterData[]) {
  return employees.length > 0 && employees.every((employee) => hasPublishedQuarterGoals(employee.ownedGoals));
}

function areAnnualScoresPublished(employees: EmployeeWithAnnualData[]) {
  const activeQuarters = [1, 2, 3, 4].filter((quarter) =>
    employees.some(
      (employee) =>
        !isAnnualQuarterParticipationExcluded(employee, quarter) &&
        (
          employee.ownedGoals.some((goal) => goal.quarter === quarter) ||
          employee.historicalScores.some((score) => score.quarter === quarter))
    )
  );

  return (
    activeQuarters.length > 0 &&
    activeQuarters.every((quarter) =>
      employees
        .filter((employee) => !isAnnualQuarterParticipationExcluded(employee, quarter))
        .every((employee) => hasPublishedAnnualQuarterScore(employee, quarter))
    )
  );
}

function isQuarterParticipationExcluded(employee: Pick<EmployeeWithQuarterData, 'quarterParticipationExclusions'>) {
  return employee.quarterParticipationExclusions.length > 0;
}

function isAnnualQuarterParticipationExcluded(
  employee: Pick<EmployeeWithAnnualData, 'quarterParticipationExclusions'>,
  quarter: number
) {
  return employee.quarterParticipationExclusions.some((record) => record.quarter === quarter);
}

function hasPublishedQuarterGoals(goals: GoalWithQuarterData[]) {
  return (
    goals.length > 0 &&
    goals.every(
      (goal) =>
        goal.keyResults.length > 0 && goal.keyResults.every((keyResult) => keyResult.reviewScore !== null)
    )
  );
}

function hasPublishedAnnualQuarterScore(employee: EmployeeWithAnnualData, quarter: number) {
  const quarterGoals = employee.ownedGoals.filter((goal) => goal.quarter === quarter);
  if (quarterGoals.length > 0) {
    return hasPublishedQuarterGoals(quarterGoals);
  }

  return employee.historicalScores.some((score) => score.quarter === quarter);
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

const PENDING_REVIEW_GRADE_LABEL = '待定';
const QUARTER_RANKING_METRIC_PRIORITY: Array<keyof LeaderRankingTieBreakMetricsRecord> = [
  'customGoalScore',
  'objectiveTaskScore',
  'workAttitudeScore',
  'workCapabilityScore',
  'innovationScore',
  'learningShareScore'
];

function compareQuarterRankingCandidate(left: QuarterRankingCandidate, right: QuarterRankingCandidate) {
  const metricCompare = compareQuarterRankingCandidateMetrics(left, right);
  if (metricCompare !== 0) {
    return metricCompare;
  }

  return left.employeeName.localeCompare(right.employeeName, 'zh-CN');
}

function compareQuarterRankingCandidateMetrics(left: QuarterRankingCandidate, right: QuarterRankingCandidate) {
  const leftScore = left.quarterScore ?? -1;
  const rightScore = right.quarterScore ?? -1;
  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  for (const metricKey of QUARTER_RANKING_METRIC_PRIORITY) {
    const leftValue = left.tieBreakMetrics[metricKey];
    const rightValue = right.tieBreakMetrics[metricKey];
    if (leftValue !== rightValue) {
      return rightValue - leftValue;
    }
  }

  return 0;
}

function findQuarterRankingTieGroupEnd(entries: QuarterRankingCandidate[], startIndex: number) {
  let endIndex = startIndex;

  while (
    endIndex + 1 < entries.length &&
    compareQuarterRankingCandidateMetrics(entries[startIndex], entries[endIndex + 1]) === 0
  ) {
    endIndex += 1;
  }

  return endIndex;
}

function resolveQuarterRankingGradeByPosition(
  eligibleCount: number,
  quotas: Array<{ gradeCode: string; seatCount: number }>
) {
  const gradeByPosition = Array<string | null>(eligibleCount).fill(null);
  let cursor = 0;

  for (const gradeCode of REVIEW_GRADE_CODES) {
    const seatCount = quotas.find((quota) => quota.gradeCode === gradeCode)?.seatCount ?? 0;
    for (let index = 0; index < seatCount && cursor < eligibleCount; index += 1) {
      gradeByPosition[cursor] = gradeCode;
      cursor += 1;
    }
  }

  return gradeByPosition;
}

function buildQuarterRankingTieGroupKey(args: {
  year: number;
  quarter: number;
  reviewGroupId: string;
  entries: QuarterRankingCandidate[];
}) {
  return createHash('sha1')
    .update(
      JSON.stringify({
        year: args.year,
        quarter: args.quarter,
        reviewGroupId: args.reviewGroupId,
        employeeIds: args.entries.map((entry) => entry.employeeId).sort(),
        quarterScore: args.entries[0]?.quarterScore ?? null,
        tieBreakMetrics: args.entries[0]?.tieBreakMetrics ?? null
      })
    )
    .digest('hex');
}

function resolveQuarterRankingTieBreakOrder(
  entries: QuarterRankingCandidate[],
  decisions: RankingTieBreakDecisionData[]
) {
  if (decisions.length !== entries.length) {
    return null;
  }

  const expectedEmployeeIds = entries.map((entry) => entry.employeeId);
  const orderIndexByEmployeeId = new Map<string, number>();

  for (const decision of decisions) {
    if (!expectedEmployeeIds.includes(decision.employeeId)) {
      return null;
    }

    orderIndexByEmployeeId.set(decision.employeeId, decision.orderIndex);
  }

  if (orderIndexByEmployeeId.size !== entries.length) {
    return null;
  }

  const sortedOrderIndexes = Array.from(orderIndexByEmployeeId.values()).sort((left, right) => left - right);
  if (sortedOrderIndexes.some((orderIndex, index) => orderIndex !== index)) {
    return null;
  }

  return [...entries].sort((left, right) => {
    const leftOrder = orderIndexByEmployeeId.get(left.employeeId) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderIndexByEmployeeId.get(right.employeeId) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

function groupTieBreakDecisionsByReviewGroupId(decisions: RankingTieBreakDecisionData[]) {
  const grouped = new Map<string, RankingTieBreakDecisionData[]>();

  for (const decision of decisions) {
    const current = grouped.get(decision.reviewGroupId) ?? [];
    current.push(decision);
    grouped.set(decision.reviewGroupId, current);
  }

  return grouped;
}

function groupTieBreakDecisionsByGroupKey(decisions: RankingTieBreakDecisionData[]) {
  const grouped = new Map<string, RankingTieBreakDecisionData[]>();

  for (const decision of decisions) {
    const current = grouped.get(decision.groupKey) ?? [];
    current.push(decision);
    grouped.set(decision.groupKey, current);
  }

  return grouped;
}

function resolveQuarterRankingMetricKey(
  value: string
): Exclude<keyof LeaderRankingTieBreakMetricsRecord, 'customGoalScore'> | null {
  const normalized = value.replace(/\s+/g, '');

  if (normalized.includes('目标任务综合评价')) {
    return 'objectiveTaskScore';
  }

  if (normalized.includes('工作态度')) {
    return 'workAttitudeScore';
  }

  if (normalized.includes('工作能力')) {
    return 'workCapabilityScore';
  }

  if (normalized.includes('创优争先') || normalized.includes('创新能力')) {
    return 'innovationScore';
  }

  if (normalized.includes('学习分享')) {
    return 'learningShareScore';
  }

  return null;
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
  const leftScore = left.annualScore ?? -1;
  const rightScore = right.annualScore ?? -1;

  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  return left.employeeName.localeCompare(right.employeeName, 'zh-CN');
}

function compareAnnualRankingIdentity(left: LeaderAnnualRankingEntryRecord, right: LeaderAnnualRankingEntryRecord) {
  const sectionCompare = (left.sectionName ?? '').localeCompare(right.sectionName ?? '', 'zh-CN');
  if (sectionCompare !== 0) {
    return sectionCompare;
  }

  return left.employeeName.localeCompare(right.employeeName, 'zh-CN');
}

function filterAnnualRankingEmployees(
  employees: EmployeeWithAnnualData[],
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

function buildAnnualQuarterScores(
  goals: GoalWithQuarterData[],
  historicalScores: Array<{ quarter: number; score: number }>
): LeaderAnnualQuarterScoreRecord[] {
  const historicalScoreByQuarter = new Map(historicalScores.map((item) => [item.quarter, Number(item.score.toFixed(1))]));

  return [1, 2, 3, 4].map((quarter) => {
    const quarterGoals = goals.filter((goal) => goal.quarter === quarter);
    if (quarterGoals.length > 0) {
      return {
        quarter,
        score: scoreFromGoals(quarterGoals)
      };
    }

    return {
      quarter,
      score: historicalScoreByQuarter.get(quarter) ?? 0
    };
  });
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
  const eligible = entries.filter((entry) => (entry.annualScore ?? 0) > 0);
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

function groupEmployeesByReviewGroup<T extends Pick<EmployeeWithQuarterData, 'reviewGroupId'>>(
  employees: T[]
) {
  const groups = new Map<string, T[]>();

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

function isTemplateGoal(goal: { importedTemplates: unknown[] }) {
  return goal.importedTemplates.length > 0;
}

function compareGoalCode(left: string, right: string) {
  return extractGoalCodeIndex(left) - extractGoalCodeIndex(right) || left.localeCompare(right);
}

function extractGoalCodeIndex(code: string) {
  const match = /^O(\d+)$/i.exec(code.trim());
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}
