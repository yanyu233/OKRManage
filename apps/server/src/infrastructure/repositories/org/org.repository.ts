import { ReviewGradeCode } from '../../../shared/constants/review-grade-codes';

export const ORG_REPOSITORY = Symbol('ORG_REPOSITORY');

export type AdminDepartmentRecord = {
  id: string;
  name: string;
  isActive: boolean;
};

export type AdminSectionRecord = {
  id: string;
  departmentId: string;
  name: string;
  isActive: boolean;
};

export type AdminUserRecord = {
  id: string;
  employeeNo: string | null;
  name: string;
  departmentId: string | null;
  sectionId: string | null;
  reviewGroupId: string | null;
  isActive: boolean;
};

export type AdminLocalAccountRecord = {
  userId: string;
  loginName: string;
  localLoginEnabled: boolean;
};

export type AdminLocalAccountInput = AdminLocalAccountRecord & {
  password?: string | null;
};

export type AdminRoleAssignmentRecord = {
  id: string;
  userId: string;
  roleCode: string;
  scopeType: string;
  scopeId: string;
  isPrimary: boolean;
  isEnabled: boolean;
};

export type AdminSectionLeaderBindingRecord = {
  id: string;
  leaderUserId: string;
  sectionId: string;
};

export type AdminGroupLeaderBindingRecord = {
  id: string;
  leaderUserId: string;
  reviewGroupId: string;
};

export type AdminReviewGroupQuotaRecord = {
  gradeCode: ReviewGradeCode;
  seatCount: number;
};

export type AdminReviewGroupRecord = {
  id: string;
  name: string;
  isActive: boolean;
  memberCount: number;
  quotas: AdminReviewGroupQuotaRecord[];
};

export type AdminReviewGroupInput = Omit<AdminReviewGroupRecord, 'memberCount'>;

export type AdminGoalTemplateKeyResultRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  points: number;
};

export type AdminGoalTemplateRecord = {
  id: string;
  departmentId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  keyResults: AdminGoalTemplateKeyResultRecord[];
};

export type AdminOrgBootstrap = {
  departments: AdminDepartmentRecord[];
  sections: AdminSectionRecord[];
  users: AdminUserRecord[];
  localAccounts: AdminLocalAccountRecord[];
  roleAssignments: AdminRoleAssignmentRecord[];
  sectionLeaderBindings: AdminSectionLeaderBindingRecord[];
  groupLeaderBindings: AdminGroupLeaderBindingRecord[];
  reviewGroups: AdminReviewGroupRecord[];
  goalTemplates: AdminGoalTemplateRecord[];
};

export type AdminOrgBootstrapInput = {
  departments: AdminDepartmentRecord[];
  sections: AdminSectionRecord[];
  users: AdminUserRecord[];
  localAccounts: AdminLocalAccountInput[];
  roleAssignments: AdminRoleAssignmentRecord[];
  sectionLeaderBindings: AdminSectionLeaderBindingRecord[];
  groupLeaderBindings: AdminGroupLeaderBindingRecord[];
  reviewGroups: AdminReviewGroupInput[];
  goalTemplates: AdminGoalTemplateRecord[];
};

export interface OrgRepository {
  countActiveUsersByReviewGroupId(reviewGroupId: string): Promise<number>;
  getAdminBootstrap(): Promise<AdminOrgBootstrap>;
  saveAdminBootstrap(input: AdminOrgBootstrapInput): Promise<void>;
}
