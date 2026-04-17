import { AuthUser } from '../../../shared/types/auth-user';

export const LEADER_REPOSITORY = Symbol('LEADER_REPOSITORY');
export type LeaderScoreType = 'objective' | 'subjective';

export type LeaderProofRecord = {
  id: string;
  fileName: string;
  previewUrl: string;
  downloadUrl: string;
  fileUrl: string;
  fileSize: number;
  note: string | null;
  isKnowledge: boolean;
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
  goalBreakdown: LeaderRankingGoalBreakdownRecord[];
};

export type LeaderRankingRecord = {
  year: number;
  quarter: number;
  reviewGroups: LeaderReviewGroupRecord[];
  selectedReviewGroup: LeaderReviewGroupRecord | null;
  seatSummary: LeaderSeatSummaryRecord[];
  ranking: LeaderRankingEntryRecord[];
  selectedEmployee: LeaderRankingSelectedEmployeeRecord | null;
};

export type LeaderAnnualQuarterScoreRecord = {
  quarter: number;
  score: number;
};

export type LeaderAnnualRankingEntryRecord = {
  employeeId: string;
  employeeName: string;
  sectionName: string | null;
  reviewGroupName: string | null;
  annualScore: number;
  quarterScores: LeaderAnnualQuarterScoreRecord[];
};

export type LeaderAnnualRankingSelectedEmployeeRecord = LeaderAnnualRankingEntryRecord;

export type LeaderAnnualRankingRecord = {
  year: number;
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
  | 'proof-missing';

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

export type LeaderProofKnowledgeToggleResult = {
  before: {
    id: string;
    isKnowledge: boolean;
  };
  after: LeaderProofRecord;
};

export type LeaderKnowledgeEntryRecord = {
  id: string;
  fileName: string;
  previewUrl: string;
  downloadUrl: string;
  fileUrl: string;
  fileSize: number;
  note: string | null;
  isKnowledge: boolean;
  uploadedAt: string;
  updatedAt: string;
  employeeId: string;
  employeeName: string;
  sectionName: string | null;
  reviewGroupName: string | null;
  goalId: string;
  goalCode: string;
  goalName: string;
  keyResultId: string;
  keyResultCode: string;
  keyResultName: string;
};

export type LeaderKnowledgeBaseRecord = {
  entries: LeaderKnowledgeEntryRecord[];
};

export type LeaderKnowledgeProofUpdateInput = {
  fileName?: string;
  storageKey?: string;
  fileSize?: number;
  note: string | null;
};

export type LeaderKnowledgeProofUpdateResult = {
  before: {
    id: string;
    fileName: string;
    note: string | null;
    storageKey: string;
  };
  after: LeaderKnowledgeEntryRecord;
  previousStorageKey: string | null;
};

export type LeaderKnowledgeProofDownloadRecord = {
  id: string;
  fileName: string;
  storageKey: string;
  employeeName: string;
  goalCode: string;
  goalName: string;
  keyResultCode: string;
  keyResultName: string;
};

export interface LeaderRepository {
  getAllOkr(year: number, quarter: number): Promise<AllOkrRecord>;
  getWorkbench(
    actor: AuthUser,
    year: number,
    quarter: number,
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
    input: LeaderKnowledgeProofUpdateInput
  ): Promise<LeaderKnowledgeProofUpdateResult>;
  getKnowledgeProofDownloads(actor: AuthUser, proofIds: string[]): Promise<LeaderKnowledgeProofDownloadRecord[]>;
  getRanking(
    actor: AuthUser,
    year: number,
    quarter: number,
    reviewGroupId?: string | null,
    employeeId?: string | null
  ): Promise<LeaderRankingRecord>;
  getQuarterlyPublicNotice(
    actor: AuthUser,
    year: number,
    quarter: number,
    reviewGroupId?: string | null
  ): Promise<LeaderQuarterlyPublicNoticeRecord>;
  getAnnualRanking(actor: AuthUser, year: number, employeeId?: string | null): Promise<LeaderAnnualRankingRecord>;
  getAnnualPublicNotice(actor: AuthUser, year: number): Promise<LeaderAnnualPublicNoticeRecord>;
}
