import { AuthUser } from '../../../shared/types/auth-user';

export const LEADER_REPOSITORY = Symbol('LEADER_REPOSITORY');

export type LeaderProofRecord = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  note: string | null;
  uploadedAt: string;
};

export type LeaderKeyResultRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  points: number;
  canScore: boolean;
  completionState: string;
  reviewScore: number | null;
  reviewComment: string | null;
  proofCount: number;
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
  proofCount: number;
  currentScore: number | null;
};

export type LeaderGoalDetailRecord = LeaderGoalSummaryRecord & {
  keyResults: LeaderKeyResultRecord[];
};

export type LeaderEmployeeSummaryRecord = {
  id: string;
  name: string;
  sectionId: string | null;
  sectionName: string | null;
  reviewGroupId: string | null;
  reviewGroupName: string | null;
  canScore: boolean;
  goalCount: number;
  keyResultCount: number;
  scoredKeyResultCount: number;
  proofCount: number;
  quarterScore: number | null;
  status: string;
};

export type LeaderWorkbenchRecord = {
  year: number;
  quarter: number;
  employees: LeaderEmployeeSummaryRecord[];
  selectedEmployee: LeaderEmployeeSummaryRecord | null;
  goals: LeaderGoalSummaryRecord[];
  selectedGoal: LeaderGoalDetailRecord | null;
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

export type LeaderScoreUpdateResult = {
  before: {
    id: string;
    reviewScore: number | null;
    reviewComment: string | null;
  };
  after: LeaderKeyResultRecord;
};

export type LeaderBulkScoreSkipReason = 'out-of-scope' | 'already-scored';

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
  score: number;
  comment: string | null;
  overwriteExisting: boolean;
  excludeTemplateGoals: boolean;
};

export type LeaderBulkScoreResult = {
  updatedCount: number;
  skippedCount: number;
  skipped: LeaderBulkScoreSkipRecord[];
};

export interface LeaderRepository {
  getWorkbench(
    actor: AuthUser,
    year: number,
    quarter: number,
    employeeId?: string | null,
    goalId?: string | null
  ): Promise<LeaderWorkbenchRecord>;
  updateKeyResultScore(actor: AuthUser, krId: string, score: number, comment: string | null): Promise<LeaderScoreUpdateResult>;
  batchScore(actor: AuthUser, input: LeaderBulkScoreInput): Promise<LeaderBulkScoreResult>;
  getRanking(
    actor: AuthUser,
    year: number,
    quarter: number,
    reviewGroupId?: string | null,
    employeeId?: string | null
  ): Promise<LeaderRankingRecord>;
}
