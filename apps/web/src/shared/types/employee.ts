export type EmployeeProof = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  note: string | null;
  uploadedAt: string;
};

export type EmployeeKeyResult = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  points: number;
  completionState: string;
  reviewScore: number | null;
  reviewComment: string | null;
  proofCount: number;
  proofs: EmployeeProof[];
};

export type EmployeeGoalSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  totalPoints: number;
  keyResultCount: number;
  completedKeyResultCount: number;
  proofCount: number;
  currentScore: number | null;
};

export type EmployeeQuarterSummary = {
  id: string;
  name: string;
  sectionName: string | null;
  reviewGroupName: string | null;
  goalCount: number;
  keyResultCount: number;
  completedKeyResultCount: number;
  proofCount: number;
  quarterScore: number | null;
};

export type EmployeeOkrResponse = {
  year: number;
  quarter: number;
  employee: EmployeeQuarterSummary;
  goals: EmployeeGoalSummary[];
};

export type EmployeeGoalDetail = EmployeeGoalSummary & {
  year: number;
  quarter: number;
  keyResults: EmployeeKeyResult[];
};

export type UpdateKrCompletionInput = {
  completionState: 'incomplete' | 'completed';
};
