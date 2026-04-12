export type LeaderProof = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  note: string | null;
  uploadedAt: string;
};

export type LeaderKeyResult = {
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
  proofCount: number;
  currentScore: number | null;
};

export type LeaderGoalDetail = LeaderGoalSummary & {
  keyResults: LeaderKeyResult[];
};

export type LeaderEmployeeSummary = {
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

export type LeaderWorkbenchResponse = {
  year: number;
  quarter: number;
  employees: LeaderEmployeeSummary[];
  selectedEmployee: LeaderEmployeeSummary | null;
  goals: LeaderGoalSummary[];
  selectedGoal: LeaderGoalDetail | null;
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
  score: number;
  comment?: string;
  overwriteExisting?: boolean;
  excludeTemplateGoals?: boolean;
};

export type BulkLeaderKrScoreResponse = {
  updatedCount: number;
  skippedCount: number;
  skipped: Array<{
    keyResultId: string;
    reason: 'out-of-scope' | 'already-scored';
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
