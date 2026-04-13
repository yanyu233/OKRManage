import { AuthUser } from '../../../shared/types/auth-user';

export const EMPLOYEE_REPOSITORY = Symbol('EMPLOYEE_REPOSITORY');
export type EmployeeScoreType = 'objective' | 'subjective';

export type EmployeeProofRecord = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  note: string | null;
  uploadedAt: string;
};

export type EmployeeKeyResultRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  points: number;
  scoreType: EmployeeScoreType;
  completionState: string;
  reviewScore: number | null;
  reviewComment: string | null;
  proofCount: number;
  proofs: EmployeeProofRecord[];
};

export type EmployeeGoalSummaryRecord = {
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

export type EmployeeGoalTemplateKeyResultRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  points: number;
  scoreType: EmployeeScoreType;
};

export type EmployeeGoalTemplateSummaryRecord = {
  id: string;
  departmentId: string;
  departmentName: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
  totalPoints: number;
  keyResultCount: number;
  alreadyImported: boolean;
  keyResults: EmployeeGoalTemplateKeyResultRecord[];
};

export type EmployeeGoalDetailRecord = EmployeeGoalSummaryRecord & {
  year: number;
  quarter: number;
  keyResults: EmployeeKeyResultRecord[];
};

export type EmployeeQuarterSummaryRecord = {
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

export type EmployeeQuarterRecord = {
  year: number;
  quarter: number;
  employee: EmployeeQuarterSummaryRecord;
  goals: EmployeeGoalSummaryRecord[];
};

export type EmployeeGoalTemplateRecord = {
  year: number;
  quarter: number;
  departmentId: string | null;
  departmentName: string | null;
  templates: EmployeeGoalTemplateSummaryRecord[];
};

export type EmployeeCompletionUpdateResult = {
  before: {
    id: string;
    completionState: string;
  };
  after: EmployeeKeyResultRecord;
};

export type EmployeeProofUploadResult = {
  proof: EmployeeProofRecord;
  keyResultId: string;
};

export type EmployeeGoalTemplateImportResult = {
  year: number;
  quarter: number;
  importedGoals: EmployeeGoalSummaryRecord[];
};

export type EmployeeCreateGoalInput = {
  year: number;
  quarter: number;
  name: string;
  description: string | null;
  keyResults: Array<{
    id?: string;
    code: string;
    name: string;
    description: string | null;
    points: number;
    scoreType?: EmployeeScoreType;
  }>;
};

export type EmployeeGoalUpdateInput = {
  name: string;
  description: string | null;
  keyResults: Array<{
    id?: string;
    code: string;
    name: string;
    description: string | null;
    points: number;
    scoreType?: EmployeeScoreType;
  }>;
};

export type EmployeeGoalCreateResult = EmployeeGoalDetailRecord & {
  owner: {
    id: string;
    name: string;
  };
};

export type EmployeeGoalStatusControlRecord = {
  goalId: string;
  ownerUserId: string;
  ownerName: string;
  year: number;
  quarter: number;
  code: string;
  name: string;
  status: string;
};

export type ProofDownloadRecord = {
  proofId: string;
  fileName: string;
  storageKey: string;
};

export interface EmployeeRepository {
  getQuarterOverview(actor: AuthUser, year: number, quarter: number): Promise<EmployeeQuarterRecord>;
  getGoalTemplates(actor: AuthUser, year: number, quarter: number): Promise<EmployeeGoalTemplateRecord>;
  importGoalTemplates(
    actor: AuthUser,
    year: number,
    quarter: number,
    templateIds: string[]
  ): Promise<EmployeeGoalTemplateImportResult>;
  createGoal(actor: AuthUser, input: EmployeeCreateGoalInput): Promise<EmployeeGoalCreateResult>;
  updateGoal(actor: AuthUser, goalId: string, input: EmployeeGoalUpdateInput): Promise<EmployeeGoalDetailRecord>;
  getGoalDetail(actor: AuthUser, goalId: string): Promise<EmployeeGoalDetailRecord>;
  submitGoalForReview(actor: AuthUser, goalId: string): Promise<EmployeeGoalDetailRecord>;
  updateKeyResultCompletion(actor: AuthUser, krId: string, completionState: string): Promise<EmployeeCompletionUpdateResult>;
  createProof(
    actor: AuthUser,
    krId: string,
    input: { fileName: string; storageKey: string; fileSize: number; note: string | null }
  ): Promise<EmployeeProofUploadResult>;
  getProofDownload(actor: AuthUser, proofId: string): Promise<ProofDownloadRecord>;
}
