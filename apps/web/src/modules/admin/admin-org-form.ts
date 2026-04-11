import type {
  AdminOrgBootstrap,
  AdminOrgBootstrapInput,
  GoalTemplateRecord,
  GroupLeaderBindingRecord,
  LocalAccountRecord,
  ReviewGradeCode,
  ReviewGroupRecord,
  RoleAssignmentRecord,
  SectionLeaderBindingRecord,
  UserRoleCode
} from '../../shared/types/admin-config';

const REVIEW_GRADE_CODES: ReviewGradeCode[] = ['A+', 'A', 'B+', 'B', 'C'];

export function summarizeBootstrap(config: AdminOrgBootstrap | AdminOrgBootstrapInput) {
  return {
    departmentCount: config.departments.length,
    sectionCount: config.sections.length,
    userCount: config.users.length,
    reviewGroupCount: config.reviewGroups.length,
    localAccountCount: config.localAccounts.length,
    roleAssignmentCount: config.roleAssignments.length
  };
}

export function createEmptyBootstrap(): AdminOrgBootstrapInput {
  return {
    departments: [],
    sections: [],
    users: [],
    localAccounts: [],
    roleAssignments: [],
    sectionLeaderBindings: [],
    groupLeaderBindings: [],
    reviewGroups: [],
    goalTemplates: []
  };
}

export function createDepartmentRecord() {
  return {
    id: createId('dept'),
    name: '',
    isActive: true
  };
}

export function createSectionRecord(defaultDepartmentId: string | null = null) {
  return {
    id: createId('section'),
    departmentId: defaultDepartmentId ?? '',
    name: '',
    isActive: true
  };
}

export function createUserRecord(defaultDepartmentId: string | null = null, defaultSectionId: string | null = null) {
  return {
    id: createId('user'),
    employeeNo: null,
    name: '',
    departmentId: defaultDepartmentId,
    sectionId: defaultSectionId,
    reviewGroupId: null,
    isActive: true
  };
}

export function createLocalAccountRecord(defaultUserId: string | null = null): LocalAccountRecord {
  return {
    userId: defaultUserId ?? '',
    loginName: '',
    localLoginEnabled: true,
    password: ''
  };
}

export function createRoleAssignmentRecord(defaultUserId: string | null = null, roleCode: UserRoleCode = 'employee'): RoleAssignmentRecord {
  return {
    id: createId('role'),
    userId: defaultUserId ?? '',
    roleCode,
    scopeType: roleCode === 'system-admin' ? 'system' : 'section',
    scopeId: roleCode === 'system-admin' ? 'system' : '',
    isPrimary: roleCode === 'employee',
    isEnabled: true
  };
}

export function createSectionLeaderBindingRecord(
  defaultLeaderUserId: string | null = null,
  defaultSectionId: string | null = null
): SectionLeaderBindingRecord {
  return {
    id: createId('section-leader'),
    leaderUserId: defaultLeaderUserId ?? '',
    sectionId: defaultSectionId ?? ''
  };
}

export function createGroupLeaderBindingRecord(
  defaultLeaderUserId: string | null = null,
  defaultReviewGroupId: string | null = null
): GroupLeaderBindingRecord {
  return {
    id: createId('group-leader'),
    leaderUserId: defaultLeaderUserId ?? '',
    reviewGroupId: defaultReviewGroupId ?? ''
  };
}

export function createReviewGroupRecord(): Omit<ReviewGroupRecord, 'memberCount'> {
  return {
    id: createId('review-group'),
    name: '',
    isActive: true,
    quotas: REVIEW_GRADE_CODES.map((gradeCode) => ({ gradeCode, seatCount: 0 }))
  };
}

export function createGoalTemplateRecord(defaultDepartmentId: string | null = null): GoalTemplateRecord {
  return {
    id: createId('goal-template'),
    departmentId: defaultDepartmentId ?? '',
    name: '',
    description: null,
    isActive: true,
    keyResults: [createGoalTemplateKeyResultRecord('KR1')]
  };
}

export function createGoalTemplateKeyResultRecord(code = 'KR1') {
  return {
    id: createId('goal-template-kr'),
    code,
    name: '',
    description: null,
    points: 0
  };
}

export function totalQuotaSeats(reviewGroup: Pick<ReviewGroupRecord, 'quotas'>) {
  return reviewGroup.quotas.reduce((sum, quota) => sum + quota.seatCount, 0);
}

export function toAdminBootstrapInput(bootstrap: AdminOrgBootstrap): AdminOrgBootstrapInput {
  return {
    departments: bootstrap.departments.map((department) => ({ ...department })),
    sections: bootstrap.sections.map((section) => ({ ...section })),
    users: bootstrap.users.map((user) => ({ ...user })),
    localAccounts: bootstrap.localAccounts.map((account) => ({ ...account, password: '' })),
    roleAssignments: bootstrap.roleAssignments.map((assignment) => ({ ...assignment })),
    sectionLeaderBindings: bootstrap.sectionLeaderBindings.map((binding) => ({ ...binding })),
    groupLeaderBindings: bootstrap.groupLeaderBindings.map((binding) => ({ ...binding })),
    reviewGroups: bootstrap.reviewGroups.map((reviewGroup) => ({
      id: reviewGroup.id,
      name: reviewGroup.name,
      isActive: reviewGroup.isActive,
      quotas: reviewGroup.quotas.map((quota) => ({ ...quota }))
    })),
    goalTemplates: bootstrap.goalTemplates.map((template) => ({
      id: template.id,
      departmentId: template.departmentId,
      name: template.name,
      description: template.description,
      isActive: template.isActive,
      keyResults: template.keyResults.map((keyResult) => ({ ...keyResult }))
    }))
  };
}

function createId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${random}`;
}
