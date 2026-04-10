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
  sectionName: string | null;
  reviewGroupId: string | null;
  reviewGroupName: string | null;
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

export interface LeaderRepository {
  getWorkbench(
    actor: AuthUser,
    year: number,
    quarter: number,
    employeeId?: string | null,
    goalId?: string | null
  ): Promise<LeaderWorkbenchRecord>;
  updateKeyResultScore(actor: AuthUser, krId: string, score: number, comment: string | null): Promise<LeaderScoreUpdateResult>;
  getRanking(
    actor: AuthUser,
    year: number,
    quarter: number,
    reviewGroupId?: string | null,
    employeeId?: string | null
  ): Promise<LeaderRankingRecord>;
}
