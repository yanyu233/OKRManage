import { AuthUser } from '../../../shared/types/auth-user';

export const EMPLOYEE_REPOSITORY = Symbol('EMPLOYEE_REPOSITORY');

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

export type ProofDownloadRecord = {
  proofId: string;
  fileName: string;
  storageKey: string;
};

export interface EmployeeRepository {
  getQuarterOverview(actor: AuthUser, year: number, quarter: number): Promise<EmployeeQuarterRecord>;
  getGoalDetail(actor: AuthUser, goalId: string): Promise<EmployeeGoalDetailRecord>;
  updateKeyResultCompletion(actor: AuthUser, krId: string, completionState: string): Promise<EmployeeCompletionUpdateResult>;
  createProof(
    actor: AuthUser,
    krId: string,
    input: { fileName: string; storageKey: string; fileSize: number; note: string | null }
  ): Promise<EmployeeProofUploadResult>;
  getProofDownload(actor: AuthUser, proofId: string): Promise<ProofDownloadRecord>;
}
