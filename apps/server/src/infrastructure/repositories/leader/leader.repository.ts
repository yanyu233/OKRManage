import { AuthUser } from '../../../shared/types/auth-user';

export const LEADER_REPOSITORY = Symbol('LEADER_REPOSITORY');
export type LeaderScoreType = 'objective' | 'subjective';
export type LeaderKnowledgeEntryType = 'proof' | 'manual';

export type LeaderProofRecord = {
  id: string;
  fileName: string;
  previewUrl: string;
  downloadUrl: string;
  fileUrl: string;
  fileSize: number;
  note: string | null;
  isKnowledge: boolean;
  canManageKnowledge: boolean;
  uploadedAt: string;
  updatedAt: string;
};

export type LeaderKeyResultRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  points: number;
  scoreType: LeaderScoreType;
  canScore: boolean;
  completionState: string;
  reviewScore: number | null;
  reviewComment: string | null;
  hasProofs: boolean;
  isProofMissing: boolean;
  proofCount: number;
  latestProofUploadedAt: string | null;
  proofs: LeaderProofRecord[];
};

export type LeaderGoalSummaryRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  totalPoints: number;
  canScore: boolean;
  isTemplateGoal: boolean;
  keyResultCount: number;
  scoredKeyResultCount: number;
  missingProofKeyResultCount: number;
  proofCount: number;
  currentScore: number | null;
};

export type LeaderGoalDetailRecord = LeaderGoalSummaryRecord & {
  keyResults: LeaderKeyResultRecord[];
};

export type LeaderEmployeeSummaryRecord = {
  id: string;
  name: string;
  positionName: string | null;
  departmentName: string | null;
  sectionId: string | null;
  sectionName: string | null;
  reviewGroupId: string | null;
  reviewGroupName: string | null;
  canScore: boolean;
  goalCount: number;
  keyResultCount: number;
  scoredKeyResultCount: number;
  missingProofKeyResultCount: number;
  proofCount: number;
  quarterScore: number | null;
  status: string;
};

export type AllOkrKeyResultRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  points: number;
  scoreType: LeaderScoreType;
  completionState: string;
  reviewScore: number | null;
  reviewComment: string | null;
  hasProofs: boolean;
  isProofMissing: boolean;
  proofCount: number;
  latestProofUploadedAt: string | null;
};

export type AllOkrGoalRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  totalPoints: number;
  isTemplateGoal: boolean;
  keyResultCount: number;
  completedKeyResultCount: number;
  scoredKeyResultCount: number;
  missingProofKeyResultCount: number;
  proofCount: number;
  currentScore: number | null;
  keyResults: AllOkrKeyResultRecord[];
};

export type AllOkrEmployeeRecord = {
  id: string;
  name: string;
  positionName: string | null;
  departmentName: string | null;
  sectionId: string | null;
  sectionName: string | null;
  reviewGroupId: string | null;
  reviewGroupName: string | null;
  goalCount: number;
  keyResultCount: number;
  completedKeyResultCount: number;
  scoredKeyResultCount: number;
  missingProofKeyResultCount: number;
  proofCount: number;
  quarterScore: number | null;
  status: string;
  goals: AllOkrGoalRecord[];
};

export type AllOkrRecord = {
  year: number;
  quarter: number;
  scoresVisible: boolean;
  employees: AllOkrEmployeeRecord[];
};

export type LeaderBulkCatalogKeyResultRecord = {
  id: string;
  code: string;
  name: string;
  points: number;
  scoreType: LeaderScoreType;
  reviewScore: number | null;
  proofCount: number;
  hasProofs: boolean;
  isProofMissing: boolean;
};

export type LeaderBulkCatalogGoalRecord = {
  id: string;
  code: string;
  name: string;
  isTemplateGoal: boolean;
  keyResults: LeaderBulkCatalogKeyResultRecord[];
};

export type LeaderBulkCatalogEmployeeRecord = {
  id: string;
  name: string;
  sectionId: string | null;
  sectionName: string | null;
  reviewGroupId: string | null;
  reviewGroupName: string | null;
  canScore: boolean;
  goals: LeaderBulkCatalogGoalRecord[];
};

export type LeaderWorkbenchRecord = {
  year: number;
  quarter: number;
  scoreType: LeaderScoreType;
  employees: LeaderEmployeeSummaryRecord[];
  selectedEmployee: LeaderEmployeeSummaryRecord | null;
  goals: LeaderGoalSummaryRecord[];
  selectedGoal: LeaderGoalDetailRecord | null;
  bulkCatalog: LeaderBulkCatalogEmployeeRecord[];
};

export type LeaderReviewGroupRecord = {
  id: string;
  name: string;
};

export type LeaderSeatSummaryRecord = {
  gradeCode: string;
  seatCount: number;
  occupiedCount: number;
};

export type LeaderRankingTieBreakMetricsRecord = {
  customGoalScore: number;
  objectiveTaskScore: number;
  workAttitudeScore: number;
  workCapabilityScore: number;
  innovationScore: number;
  learningShareScore: number;
};

export type LeaderRankingTieBreakStatusRecord = 'none' | 'pending' | 'resolved';

export type LeaderRankingEntryRecord = {
  employeeId: string;
  employeeName: string;
  sectionName: string | null;
  quarterScore: number | null;
  goalCount: number;
  keyResultCount: number;
  scoredKeyResultCount: number;
  proofCount: number;
  currentGrade: string | null;
  status: string;
  tieBreakStatus: LeaderRankingTieBreakStatusRecord;
};

export type LeaderRankingGoalBreakdownRecord = {
  goalId: string;
  goalCode: string;
  goalName: string;
  goalScore: number | null;
  keyResultCount: number;
  scoredKeyResultCount: number;
  keyResults: Array<{
    keyResultId: string;
    code: string;
    name: string;
    points: number;
    reviewScore: number | null;
  }>;
};

export type LeaderRankingSelectedEmployeeRecord = {
  employeeId: string;
  employeeName: string;
  sectionName: string | null;
  reviewGroupName: string | null;
  quarterScore: number | null;
  currentGrade: string | null;
  tieBreakStatus: LeaderRankingTieBreakStatusRecord;
  goalBreakdown: LeaderRankingGoalBreakdownRecord[];
};

export type LeaderRankingTieBreakEmployeeRecord = {
  employeeId: string;
  employeeName: string;
  sectionName: string | null;
  quarterScore: number | null;
  currentGrade: string | null;
  tieBreakMetrics: LeaderRankingTieBreakMetricsRecord;
};

export type LeaderRankingTieGroupRecord = {
  groupKey: string;
  reviewGroupId: string;
  reviewGroupName: string;
  rankStart: number;
  rankEnd: number;
  affectedGradeCodes: string[];
  employees: LeaderRankingTieBreakEmployeeRecord[];
};

export type LeaderRankingRecord = {
  year: number;
  quarter: number;
  scoresVisible: boolean;
  canManageTieBreaks: boolean;
  reviewGroups: LeaderReviewGroupRecord[];
  selectedReviewGroup: LeaderReviewGroupRecord | null;
  seatSummary: LeaderSeatSummaryRecord[];
  ranking: LeaderRankingEntryRecord[];
  selectedEmployee: LeaderRankingSelectedEmployeeRecord | null;
  pendingTieGroups: LeaderRankingTieGroupRecord[];
};

export type LeaderAnnualQuarterScoreRecord = {
  quarter: number;
  score: number | null;
};

export type LeaderAnnualRankingEntryRecord = {
  employeeId: string;
  employeeName: string;
  sectionId: string | null;
  sectionName: string | null;
  reviewGroupId: string | null;
  reviewGroupName: string | null;
  annualScore: number | null;
  quarterScores: LeaderAnnualQuarterScoreRecord[];
};

export type LeaderAnnualRankingSelectedEmployeeRecord = LeaderAnnualRankingEntryRecord;

export type LeaderAnnualRankingRecord = {
  year: number;
  scoresVisible: boolean;
  ranking: LeaderAnnualRankingEntryRecord[];
  selectedEmployee: LeaderAnnualRankingSelectedEmployeeRecord | null;
};

export type LeaderPublicNoticeEntryRecord = {
  employeeId: string;
  employeeNo: string | null;
  employeeName: string;
  departmentName: string | null;
  sectionName: string | null;
  positionName: string | null;
  reviewGroupName: string | null;
  resultLabel: string;
};

export type LeaderQuarterlyPublicNoticeRecord = {
  year: number;
  quarter: number;
  departmentName: string | null;
  reviewGroupName: string | null;
  entries: LeaderPublicNoticeEntryRecord[];
};

export type LeaderAnnualPublicNoticeRecord = {
  year: number;
  departmentName: string | null;
  entries: LeaderPublicNoticeEntryRecord[];
};

export type LeaderScoreUpdateResult = {
  before: {
    id: string;
    reviewScore: number | null;
    reviewComment: string | null;
  };
  after: LeaderKeyResultRecord;
};

export type LeaderBulkScoreSkipReason =
  | 'out-of-scope'
  | 'already-scored'
  | 'subjective-only'
  | 'goal-status-blocked'
  | 'proof-missing'
  | 'score-exceeds-points';

export type LeaderBulkScoreSkipRecord = {
  keyResultId: string;
  reason: LeaderBulkScoreSkipReason;
};

export type LeaderBulkScoreInput = {
  year: number;
  quarter: number;
  sectionId?: string | null;
  reviewGroupId?: string | null;
  employeeIds?: string[];
  goalIds?: string[];
  keyResultIds?: string[];
  score?: number | null;
  comment: string | null;
  overwriteExisting: boolean;
  excludeTemplateGoals: boolean;
  allowMissingProofs: boolean;
};

export type LeaderBulkScoreResult = {
  updatedCount: number;
  skippedCount: number;
  skipped: LeaderBulkScoreSkipRecord[];
};

export type LeaderRankingTieBreakSaveInput = {
  year: number;
  quarter: number;
  reviewGroupId: string;
  groupKey: string;
  orderedEmployeeIds: string[];
  decidedByUserId: string;
};

export type LeaderProofKnowledgeToggleResult = {
  before: {
    id: string;
    isKnowledge: boolean;
  };
  after: LeaderProofRecord;
};

export type LeaderKnowledgeEntryRecord = {
  entryKey: string;
  entryType: LeaderKnowledgeEntryType;
  id: string;
  fileName: string;
  previewUrl: string;
  downloadUrl: string;
  fileUrl: string;
  fileSize: number;
  note: string | null;
  isKnowledge: boolean;
  canManageKnowledge: boolean;
  uploadedAt: string;
  updatedAt: string;
  uploaderName: string | null;
  employeeId: string | null;
  employeeName: string | null;
  sectionName: string | null;
  reviewGroupName: string | null;
  goalId: string | null;
  goalCode: string | null;
  goalName: string | null;
  keyResultId: string | null;
  keyResultCode: string | null;
  keyResultName: string | null;
};

export type LeaderKnowledgeBaseRecord = {
  entries: LeaderKnowledgeEntryRecord[];
};

export type LeaderKnowledgeEntryUpdateInput = {
  fileName?: string;
  storageKey?: string;
  fileSize?: number;
  note: string | null;
};

export type LeaderKnowledgeEntryUpdateResult = {
  before: {
    id: string;
    entryType: LeaderKnowledgeEntryType;
    fileName: string;
    note: string | null;
    storageKey: string;
  };
  after: LeaderKnowledgeEntryRecord;
  previousStorageKey: string | null;
};

export type LeaderKnowledgeDownloadRecord = {
  entryKey: string;
  entryType: LeaderKnowledgeEntryType;
  id: string;
  fileName: string;
  storageKey: string;
  uploaderName: string | null;
  employeeName: string | null;
  goalCode: string | null;
  goalName: string | null;
  keyResultCode: string | null;
  keyResultName: string | null;
};

export type LeaderManualKnowledgeAssetCreateInput = {
  fileName: string;
  storageKey: string;
  fileSize: number;
  note: string | null;
};

export type LeaderKnowledgeAssetFileRecord = {
  id: string;
  fileName: string;
  storageKey: string;
};

export type LeaderKnowledgeAssetDeleteResult = {
  id: string;
  fileName: string;
  note: string | null;
  storageKey: string;
};

export interface LeaderRepository {
  getAllOkr(actor: AuthUser, year: number, quarter: number): Promise<AllOkrRecord>;
  getWorkbench(
    actor: AuthUser,
    year: number,
    quarter: number,
    scoreType: LeaderScoreType,
    employeeId?: string | null,
    goalId?: string | null
  ): Promise<LeaderWorkbenchRecord>;
  updateKeyResultScore(actor: AuthUser, krId: string, score: number, comment: string | null): Promise<LeaderScoreUpdateResult>;
  batchScore(actor: AuthUser, input: LeaderBulkScoreInput): Promise<LeaderBulkScoreResult>;
  updateProofKnowledge(actor: AuthUser, proofId: string, isKnowledge: boolean): Promise<LeaderProofKnowledgeToggleResult>;
  getKnowledgeBase(actor: AuthUser): Promise<LeaderKnowledgeBaseRecord>;
  updateKnowledgeProof(
    actor: AuthUser,
    proofId: string,
    input: LeaderKnowledgeEntryUpdateInput
  ): Promise<LeaderKnowledgeEntryUpdateResult>;
  createManualKnowledgeAsset(
    actor: AuthUser,
    input: LeaderManualKnowledgeAssetCreateInput
  ): Promise<LeaderKnowledgeEntryRecord>;
  updateManualKnowledgeAsset(
    actor: AuthUser,
    assetId: string,
    input: LeaderKnowledgeEntryUpdateInput
  ): Promise<LeaderKnowledgeEntryUpdateResult>;
  deleteManualKnowledgeAsset(actor: AuthUser, assetId: string): Promise<LeaderKnowledgeAssetDeleteResult>;
  getKnowledgeEntryDownloads(actor: AuthUser, entryKeys: string[]): Promise<LeaderKnowledgeDownloadRecord[]>;
  getManualKnowledgeAssetDownload(actor: AuthUser, assetId: string): Promise<LeaderKnowledgeAssetFileRecord>;
  getManualKnowledgeAssetStorage(assetId: string): Promise<LeaderKnowledgeAssetFileRecord>;
  getRanking(
    actor: AuthUser,
    year: number,
    quarter: number,
    reviewGroupId?: string | null,
    employeeId?: string | null
  ): Promise<LeaderRankingRecord>;
  saveRankingTieBreakDecision(input: LeaderRankingTieBreakSaveInput): Promise<void>;
  getQuarterlyPublicNotice(
    actor: AuthUser,
    year: number,
    quarter: number,
    reviewGroupId?: string | null
  ): Promise<LeaderQuarterlyPublicNoticeRecord>;
  getAnnualRanking(actor: AuthUser, year: number, employeeId?: string | null): Promise<LeaderAnnualRankingRecord>;
  getAnnualPublicNotice(
    actor: AuthUser,
    year: number,
    sectionId?: string | null,
    reviewGroupId?: string | null
  ): Promise<LeaderAnnualPublicNoticeRecord>;
}
