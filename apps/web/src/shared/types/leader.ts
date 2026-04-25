import type { ScoreType } from './admin-config';

export type LeaderProof = {
  id: string;
  fileName: string;
  previewUrl?: string;
  downloadUrl?: string;
  fileUrl: string;
  fileSize: number;
  note: string | null;
  isKnowledge: boolean;
  canManageKnowledge: boolean;
  uploadedAt: string;
  updatedAt: string;
};

export type LeaderKeyResult = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  points: number;
  scoreType: ScoreType;
  canScore: boolean;
  completionState: string;
  reviewScore: number | null;
  reviewComment: string | null;
  hasProofs: boolean;
  isProofMissing: boolean;
  proofCount: number;
  latestProofUploadedAt: string | null;
  proofs: LeaderProof[];
};

export type LeaderGoalSummary = {
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

export type LeaderGoalDetail = LeaderGoalSummary & {
  keyResults: LeaderKeyResult[];
};

export type LeaderEmployeeSummary = {
  id: string;
  name: string;
  positionName?: string | null;
  departmentName?: string | null;
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

export type AllOkrKeyResult = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  points: number;
  scoreType: ScoreType;
  completionState: string;
  reviewScore: number | null;
  reviewComment: string | null;
  hasProofs: boolean;
  isProofMissing: boolean;
  proofCount: number;
  latestProofUploadedAt: string | null;
};

export type AllOkrGoal = {
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
  keyResults: AllOkrKeyResult[];
};

export type AllOkrEmployee = {
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
  goals: AllOkrGoal[];
};

export type AllOkrResponse = {
  year: number;
  quarter: number;
  scoresVisible: boolean;
  employees: AllOkrEmployee[];
};

export type LeaderBulkCatalogKeyResult = {
  id: string;
  code: string;
  name: string;
  points: number;
  scoreType: ScoreType;
  reviewScore: number | null;
  proofCount: number;
  hasProofs: boolean;
  isProofMissing: boolean;
};

export type LeaderBulkCatalogGoal = {
  id: string;
  code: string;
  name: string;
  isTemplateGoal: boolean;
  keyResults: LeaderBulkCatalogKeyResult[];
};

export type LeaderBulkCatalogEmployee = {
  id: string;
  name: string;
  sectionId: string | null;
  sectionName: string | null;
  reviewGroupId: string | null;
  reviewGroupName: string | null;
  canScore: boolean;
  goals: LeaderBulkCatalogGoal[];
};

export type LeaderWorkbenchResponse = {
  year: number;
  quarter: number;
  scoreType: ScoreType;
  employees: LeaderEmployeeSummary[];
  selectedEmployee: LeaderEmployeeSummary | null;
  goals: LeaderGoalSummary[];
  selectedGoal: LeaderGoalDetail | null;
  bulkCatalog: LeaderBulkCatalogEmployee[];
};

export type UpdateLeaderKrScoreInput = {
  score: number;
  comment?: string;
};

export type BulkLeaderKrScoreInput = {
  year: number;
  quarter: number;
  sectionId?: string | null;
  reviewGroupId?: string | null;
  employeeIds?: string[];
  goalIds?: string[];
  keyResultIds?: string[];
  entries?: Array<{
    keyResultId: string;
    score: number;
    comment?: string;
  }>;
  score?: number;
  comment?: string;
  overwriteExisting?: boolean;
  excludeTemplateGoals?: boolean;
  allowMissingProofs?: boolean;
};

export type BulkLeaderKrScoreResponse = {
  updatedCount: number;
  skippedCount: number;
  skipped: Array<{
    keyResultId: string;
    reason:
      | 'out-of-scope'
      | 'already-scored'
      | 'subjective-only'
      | 'goal-status-blocked'
      | 'proof-missing'
      | 'score-exceeds-points';
  }>;
};

export type LeaderReviewGroup = {
  id: string;
  name: string;
};

export type LeaderSeatSummary = {
  gradeCode: string;
  seatCount: number;
  occupiedCount: number;
};

export type LeaderRankingTieBreakMetrics = {
  customGoalScore: number;
  objectiveTaskScore: number;
  workAttitudeScore: number;
  workCapabilityScore: number;
  innovationScore: number;
  learningShareScore: number;
};

export type LeaderRankingTieBreakStatus = 'none' | 'pending' | 'resolved';

export type LeaderRankingEntry = {
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
  tieBreakStatus: LeaderRankingTieBreakStatus;
};

export type LeaderRankingGoalBreakdown = {
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

export type LeaderRankingSelectedEmployee = {
  employeeId: string;
  employeeName: string;
  sectionName: string | null;
  reviewGroupName: string | null;
  quarterScore: number | null;
  currentGrade: string | null;
  tieBreakStatus: LeaderRankingTieBreakStatus;
  goalBreakdown: LeaderRankingGoalBreakdown[];
};

export type LeaderRankingTieBreakEmployee = {
  employeeId: string;
  employeeName: string;
  sectionName: string | null;
  quarterScore: number | null;
  currentGrade: string | null;
  tieBreakMetrics: LeaderRankingTieBreakMetrics;
};

export type LeaderRankingTieGroup = {
  groupKey: string;
  reviewGroupId: string;
  reviewGroupName: string;
  rankStart: number;
  rankEnd: number;
  affectedGradeCodes: string[];
  employees: LeaderRankingTieBreakEmployee[];
};

export type LeaderRankingResponse = {
  year: number;
  quarter: number;
  scoresVisible: boolean;
  canManageTieBreaks: boolean;
  reviewGroups: LeaderReviewGroup[];
  selectedReviewGroup: LeaderReviewGroup | null;
  seatSummary: LeaderSeatSummary[];
  ranking: LeaderRankingEntry[];
  selectedEmployee: LeaderRankingSelectedEmployee | null;
  pendingTieGroups: LeaderRankingTieGroup[];
};

export type SaveLeaderRankingTieBreakInput = {
  year: number;
  quarter: number;
  reviewGroupId: string;
  groupKey: string;
  orderedEmployeeIds: string[];
};

export type LeaderAnnualQuarterScore = {
  quarter: number;
  score: number | null;
};

export type LeaderAnnualRankingEntry = {
  employeeId: string;
  employeeName: string;
  sectionId: string | null;
  sectionName: string | null;
  reviewGroupId: string | null;
  reviewGroupName: string | null;
  annualScore: number | null;
  quarterScores: LeaderAnnualQuarterScore[];
};

export type LeaderAnnualRankingSelectedEmployee = LeaderAnnualRankingEntry;

export type LeaderAnnualRankingResponse = {
  year: number;
  scoresVisible: boolean;
  ranking: LeaderAnnualRankingEntry[];
  selectedEmployee: LeaderAnnualRankingSelectedEmployee | null;
};

export type UpdateLeaderProofKnowledgeInput = {
  isKnowledge: boolean;
};

export type LeaderKnowledgeEntry = {
  entryKey: string;
  entryType: 'proof' | 'manual';
  id: string;
  fileName: string;
  previewUrl?: string;
  downloadUrl?: string;
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

export type LeaderKnowledgeArchiveEntry = {
  path: string;
  name: string;
  fileSize: number | null;
  extension: string | null;
  previewUrl: string;
  downloadUrl: string;
};

export type LeaderKnowledgeAssetArchiveManifest = {
  assetId: string;
  fileName: string;
  downloadUrl: string;
  entryCount: number;
  entries: LeaderKnowledgeArchiveEntry[];
};

export type LeaderKnowledgeBaseResponse = {
  entries: LeaderKnowledgeEntry[];
};
