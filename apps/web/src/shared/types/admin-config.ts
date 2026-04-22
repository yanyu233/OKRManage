export type ReviewGradeCode = 'A+' | 'A' | 'B' | 'C' | 'D';
export type UserRoleCode = 'system-admin' | 'department-head' | 'section-leader' | 'group-leader' | 'employee';
export type RoleScopeType = 'system' | 'department' | 'section' | 'review-group' | 'user';
export type ScoreType = 'objective' | 'subjective';

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
  positionName: string | null;
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
  scoreType: ScoreType;
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

export type AdminGoalStatusControlRecord = {
  goalId: string;
  ownerUserId: string;
  ownerName: string;
  year: number;
  quarter: number;
  code: string;
  name: string;
  status: 'draft' | 'confirmed' | 'pending-review' | 'completed';
};

export type AdminGoalStatusControlResponse = {
  year: number;
  quarter: number;
  records: AdminGoalStatusControlRecord[];
};

export type AdminGoalStatusControlQuery = {
  year: number;
  quarter: number;
  userId?: string | null;
};

export type AdminGoalStatusTransitionInput = {
  year: number;
  quarter: number;
  userId?: string | null;
  targetStatus: 'draft' | 'confirmed' | 'pending-review';
};

export type AdminGoalStatusTransitionResponse = {
  affectedGoalCount: number;
  autoAdvancedGoalCount: number;
};

export type AdminQuarterParticipationExclusionRecord = {
  id: string;
  userId: string;
  userName: string;
  employeeNo: string | null;
  positionName: string | null;
  sectionId: string | null;
  sectionName: string | null;
  reviewGroupId: string | null;
  reviewGroupName: string | null;
};

export type AdminQuarterParticipationExclusionResponse = {
  year: number;
  quarter: number;
  records: AdminQuarterParticipationExclusionRecord[];
};

export type AdminQuarterParticipationExclusionSaveInput = {
  year: number;
  quarter: number;
  userIds: string[];
};

export type AdminHistoricalPerformanceQuarterSource = 'okr' | 'manual' | 'none';

export type AdminHistoricalPerformanceQuarterRecord = {
  quarter: 1 | 2 | 3 | 4;
  systemScore: number | null;
  manualScore: number | null;
  effectiveScore: number;
  source: AdminHistoricalPerformanceQuarterSource;
};

export type AdminHistoricalPerformanceEmployeeRecord = {
  employeeId: string;
  employeeNo: string | null;
  employeeName: string;
  positionName: string | null;
  sectionId: string | null;
  sectionName: string | null;
  reviewGroupId: string | null;
  reviewGroupName: string | null;
  annualScore: number;
  quarters: AdminHistoricalPerformanceQuarterRecord[];
};

export type AdminHistoricalPerformanceResponse = {
  year: number;
  records: AdminHistoricalPerformanceEmployeeRecord[];
};

export type AdminHistoricalPerformanceSaveItem = {
  userId: string;
  quarter: 1 | 2 | 3 | 4;
  score: number | null;
};

export type AdminHistoricalPerformanceSaveInput = {
  year: number;
  items: AdminHistoricalPerformanceSaveItem[];
};
