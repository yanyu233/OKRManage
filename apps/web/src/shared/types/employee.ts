import type { ScoreType } from './admin-config';

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
  scoreType: ScoreType;
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

export type EmployeeGoalTemplateKeyResult = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  points: number;
  scoreType: ScoreType;
};

export type EmployeeGoalTemplate = {
  id: string;
  departmentId: string;
  departmentName: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
  totalPoints: number;
  keyResultCount: number;
  alreadyImported: boolean;
  keyResults: EmployeeGoalTemplateKeyResult[];
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

export type EmployeeGoalTemplateResponse = {
  year: number;
  quarter: number;
  departmentId: string | null;
  departmentName: string | null;
  templates: EmployeeGoalTemplate[];
};

export type EmployeeGoalDetail = EmployeeGoalSummary & {
  year: number;
  quarter: number;
  keyResults: EmployeeKeyResult[];
};

export type CreateEmployeeGoalInput = {
  year: number;
  quarter: number;
  name: string;
  description?: string | null;
  keyResults: Array<{
    code: string;
    name: string;
    description?: string | null;
    points: number;
    scoreType?: ScoreType;
  }>;
};

export type UpdateKrCompletionInput = {
  completionState: 'incomplete' | 'completed';
};

export type ImportEmployeeGoalTemplatesInput = {
  year: number;
  quarter: number;
  templateIds: string[];
};

export type ImportEmployeeGoalTemplatesResponse = {
  year: number;
  quarter: number;
  importedGoals: EmployeeGoalSummary[];
};
