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

const REVIEW_GRADE_CODES: ReviewGradeCode[] = ['A+', 'A', 'B', 'C', 'D'];
export type AdminOrgSectionKey = 'structure' | 'access' | 'leaders' | 'review-groups' | 'goal-templates';

const COLLECTION_SECTION_MAP: Record<keyof AdminOrgBootstrapInput, AdminOrgSectionKey> = {
  departments: 'structure',
  sections: 'structure',
  users: 'structure',
  localAccounts: 'access',
  roleAssignments: 'access',
  sectionLeaderBindings: 'leaders',
  groupLeaderBindings: 'leaders',
  reviewGroups: 'review-groups',
  goalTemplates: 'goal-templates'
};

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
  return applyDerivedRoleAssignmentScope({
    id: createId('role'),
    userId: defaultUserId ?? '',
    roleCode,
    scopeType: 'user',
    scopeId: '',
    isPrimary: roleCode === 'employee',
    isEnabled: true
  });
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

export function createGoalTemplateRecord(
  defaultDepartmentId: string | null = null,
  defaultName = '新模板目标'
): GoalTemplateRecord {
  return {
    id: createId('goal-template'),
    departmentId: defaultDepartmentId ?? '',
    name: defaultName,
    description: null,
    isActive: true,
    keyResults: [createGoalTemplateKeyResultRecord('KR1', '关键结果1')]
  };
}

export function createGoalTemplateKeyResultRecord(code = 'KR1', name = '关键结果1') {
  return {
    id: createId('goal-template-kr'),
    code,
    name,
    description: null,
    points: 0,
    scoreType: 'subjective' as const
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

export function rollbackAdminBootstrapDraft(
  bootstrap: AdminOrgBootstrap | undefined,
  currentDraft: AdminOrgBootstrapInput
): AdminOrgBootstrapInput {
  return bootstrap ? toAdminBootstrapInput(bootstrap) : currentDraft;
}

export function sectionForCollectionKey<Key extends keyof AdminOrgBootstrapInput>(key: Key): AdminOrgSectionKey {
  return COLLECTION_SECTION_MAP[key];
}

export function buildAdminBootstrapSaveInput(
  bootstrap: AdminOrgBootstrap,
  draft: AdminOrgBootstrapInput,
  dirtySections: Iterable<AdminOrgSectionKey>
): AdminOrgBootstrapInput {
  const dirty = new Set(dirtySections);
  const baseline = toAdminBootstrapInput(bootstrap);
  const isSectionDirty = (section: AdminOrgSectionKey) =>
    dirty.has(section) || (dirty.size === 0 && sectionDiffers(section, baseline, draft));

  return {
    departments: isSectionDirty('structure') ? draft.departments.map((entry) => ({ ...entry })) : baseline.departments,
    sections: isSectionDirty('structure') ? draft.sections.map((entry) => ({ ...entry })) : baseline.sections,
    users: isSectionDirty('structure') ? draft.users.map((entry) => ({ ...entry })) : baseline.users,
    localAccounts: isSectionDirty('access') ? draft.localAccounts.map((entry) => ({ ...entry })) : baseline.localAccounts,
    roleAssignments: isSectionDirty('access')
      ? draft.roleAssignments.map((entry) => applyDerivedRoleAssignmentScope({ ...entry }))
      : baseline.roleAssignments,
    sectionLeaderBindings: isSectionDirty('leaders')
      ? draft.sectionLeaderBindings.map((entry) => ({ ...entry }))
      : baseline.sectionLeaderBindings,
    groupLeaderBindings: isSectionDirty('leaders')
      ? draft.groupLeaderBindings.map((entry) => ({ ...entry }))
      : baseline.groupLeaderBindings,
    reviewGroups: isSectionDirty('review-groups')
      ? draft.reviewGroups.map((entry) => ({
          ...entry,
          quotas: entry.quotas.map((quota) => ({
            ...quota,
            seatCount: normalizeNonNegativeInteger(quota.seatCount)
          }))
        }))
      : baseline.reviewGroups,
    goalTemplates: isSectionDirty('goal-templates')
      ? draft.goalTemplates.map((template) => ({
          ...template,
          keyResults: template.keyResults.map((keyResult) => ({
            ...keyResult,
            points: normalizeNonNegativeInteger(keyResult.points)
          }))
        }))
      : baseline.goalTemplates
  };
}

export function applyDerivedRoleAssignmentScope(assignment: RoleAssignmentRecord): RoleAssignmentRecord {
  const { scopeType, scopeId } = deriveRoleAssignmentScope(assignment.roleCode, assignment.userId);
  return {
    ...assignment,
    scopeType,
    scopeId
  };
}

export function deriveRoleAssignmentScope(roleCode: UserRoleCode, userId: string) {
  switch (roleCode) {
    case 'system-admin':
      return { scopeType: 'system' as const, scopeId: 'system' };
    case 'department-head':
      return { scopeType: 'department' as const, scopeId: `managed-department:${userId || 'pending'}` };
    case 'employee':
      return { scopeType: 'user' as const, scopeId: userId || 'user:pending' };
    case 'section-leader':
      return { scopeType: 'section' as const, scopeId: `managed-section:${userId || 'pending'}` };
    case 'group-leader':
      return { scopeType: 'review-group' as const, scopeId: `managed-group:${userId || 'pending'}` };
    default:
      return { scopeType: 'user' as const, scopeId: userId || 'user:pending' };
  }
}

export function normalizeNonNegativeInteger(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.trunc(numeric);
}

function createId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${random}`;
}

function sectionDiffers(section: AdminOrgSectionKey, baseline: AdminOrgBootstrapInput, draft: AdminOrgBootstrapInput) {
  switch (section) {
    case 'structure':
      return !areEqualCollections(baseline.departments, draft.departments)
        || !areEqualCollections(baseline.sections, draft.sections)
        || !areEqualCollections(baseline.users, draft.users);
    case 'access':
      return !areEqualCollections(baseline.localAccounts, draft.localAccounts)
        || !areEqualCollections(
          baseline.roleAssignments.map((entry) => applyDerivedRoleAssignmentScope({ ...entry })),
          draft.roleAssignments.map((entry) => applyDerivedRoleAssignmentScope({ ...entry }))
        );
    case 'leaders':
      return !areEqualCollections(baseline.sectionLeaderBindings, draft.sectionLeaderBindings)
        || !areEqualCollections(baseline.groupLeaderBindings, draft.groupLeaderBindings);
    case 'review-groups':
      return !areEqualCollections(baseline.reviewGroups, draft.reviewGroups);
    case 'goal-templates':
      return !areEqualCollections(baseline.goalTemplates, draft.goalTemplates);
    default:
      return false;
  }
}

function areEqualCollections(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}
