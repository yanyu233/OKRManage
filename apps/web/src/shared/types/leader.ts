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
    reason: 'out-of-scope' | 'already-scored' | 'subjective-only' | 'goal-status-blocked' | 'proof-missing';
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
  goalBreakdown: LeaderRankingGoalBreakdown[];
};

export type LeaderRankingResponse = {
  year: number;
  quarter: number;
  reviewGroups: LeaderReviewGroup[];
  selectedReviewGroup: LeaderReviewGroup | null;
  seatSummary: LeaderSeatSummary[];
  ranking: LeaderRankingEntry[];
  selectedEmployee: LeaderRankingSelectedEmployee | null;
};

export type LeaderAnnualQuarterScore = {
  quarter: number;
  score: number;
};

export type LeaderAnnualRankingEntry = {
  employeeId: string;
  employeeName: string;
  sectionName: string | null;
  reviewGroupName: string | null;
  annualScore: number;
  quarterScores: LeaderAnnualQuarterScore[];
};

export type LeaderAnnualRankingSelectedEmployee = LeaderAnnualRankingEntry;

export type LeaderAnnualRankingResponse = {
  year: number;
  ranking: LeaderAnnualRankingEntry[];
  selectedEmployee: LeaderAnnualRankingSelectedEmployee | null;
};

export type UpdateLeaderProofKnowledgeInput = {
  isKnowledge: boolean;
};

export type LeaderKnowledgeEntry = {
  id: string;
  fileName: string;
  previewUrl?: string;
  downloadUrl?: string;
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

export type LeaderKnowledgeBaseResponse = {
  entries: LeaderKnowledgeEntry[];
};
