export type ReviewGradeCode = 'A+' | 'A' | 'B+' | 'B' | 'C';
export type UserRoleCode = 'system-admin' | 'section-leader' | 'group-leader' | 'employee';
export type RoleScopeType = 'system' | 'department' | 'section' | 'review-group' | 'user';

export type ReviewGroupQuota = {
  gradeCode: ReviewGradeCode;
  seatCount: number;
};

export type DepartmentRecord = {
  id: string;
  name: string;
  isActive: boolean;
};

export type SectionRecord = {
  id: string;
  departmentId: string;
  name: string;
  isActive: boolean;
};

export type UserRecord = {
  id: string;
  employeeNo: string | null;
  name: string;
  departmentId: string | null;
  sectionId: string | null;
  reviewGroupId: string | null;
  isActive: boolean;
};

export type LocalAccountRecord = {
  userId: string;
  loginName: string;
  localLoginEnabled: boolean;
  password?: string | null;
};

export type RoleAssignmentRecord = {
  id: string;
  userId: string;
  roleCode: UserRoleCode;
  scopeType: RoleScopeType;
  scopeId: string;
  isPrimary: boolean;
  isEnabled: boolean;
};

export type SectionLeaderBindingRecord = {
  id: string;
  leaderUserId: string;
  sectionId: string;
};

export type GroupLeaderBindingRecord = {
  id: string;
  leaderUserId: string;
  reviewGroupId: string;
};

export type ReviewGroupRecord = {
  id: string;
  name: string;
  isActive: boolean;
  memberCount: number;
  quotas: ReviewGroupQuota[];
};

export type GoalTemplateKeyResultRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  points: number;
};

export type GoalTemplateRecord = {
  id: string;
  departmentId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  keyResults: GoalTemplateKeyResultRecord[];
};

export type AdminOrgBootstrap = {
  departments: DepartmentRecord[];
  sections: SectionRecord[];
  users: UserRecord[];
  localAccounts: LocalAccountRecord[];
  roleAssignments: RoleAssignmentRecord[];
  sectionLeaderBindings: SectionLeaderBindingRecord[];
  groupLeaderBindings: GroupLeaderBindingRecord[];
  reviewGroups: ReviewGroupRecord[];
  goalTemplates: GoalTemplateRecord[];
};

export type AdminOrgBootstrapInput = {
  departments: DepartmentRecord[];
  sections: SectionRecord[];
  users: UserRecord[];
  localAccounts: LocalAccountRecord[];
  roleAssignments: RoleAssignmentRecord[];
  sectionLeaderBindings: SectionLeaderBindingRecord[];
  groupLeaderBindings: GroupLeaderBindingRecord[];
  reviewGroups: Array<Omit<ReviewGroupRecord, 'memberCount'>>;
  goalTemplates: GoalTemplateRecord[];
};
