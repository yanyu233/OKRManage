import { ReviewGradeCode } from '../../../shared/constants/review-grade-codes';

export const REVIEW_GROUPS_REPOSITORY = Symbol('REVIEW_GROUPS_REPOSITORY');

export type ReviewGroupQuotaInput = {
  gradeCode: ReviewGradeCode;
  seatCount: number;
};

export type ReviewGroupRecord = {
  id: string;
  name: string;
  isActive: boolean;
  quotas: ReviewGroupQuotaInput[];
  memberCount: number;
};

export interface ReviewGroupsRepository {
  listAll(): Promise<ReviewGroupRecord[]>;
  create(name: string): Promise<{ id: string; name: string; isActive: boolean }>;
  update(id: string, name: string): Promise<{ id: string; name: string; isActive: boolean }>;
  delete(id: string): Promise<void>;
  saveQuotas(id: string, quotas: ReviewGroupQuotaInput[]): Promise<void>;
}
