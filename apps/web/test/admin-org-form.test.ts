import { describe, expect, it } from 'vitest';
import {
  applyDerivedRoleAssignmentScope,
  buildAdminBootstrapSaveInput,
  createGoalTemplateRecord,
  createReviewGroupRecord,
  rollbackAdminBootstrapDraft,
  sanitizeBootstrapDraft,
  summarizeBootstrap,
  totalQuotaSeats
} from '../src/modules/admin/admin-org-form';
import type { AdminOrgBootstrap, AdminOrgBootstrapInput } from '../src/shared/types/admin-config';

function createBootstrap(): AdminOrgBootstrap {
  return {
    departments: [{ id: 'dept-1', name: '工业互联网中心', isActive: true }],
    sections: [{ id: 'section-1', departmentId: 'dept-1', name: '平台产品科', isActive: true }],
    users: [
      {
        id: 'user-1',
        employeeNo: '1001',
        name: '严主任',
        departmentId: 'dept-1',
        sectionId: 'section-1',
        reviewGroupId: 'group-1',
        isActive: true
      }
    ],
    localAccounts: [{ userId: 'user-1', loginName: 'sysadmin.local', localLoginEnabled: true }],
    roleAssignments: [
      {
        id: 'role-1',
        userId: 'user-1',
        roleCode: 'system-admin',
        scopeType: 'system',
        scopeId: 'system',
        isPrimary: true,
        isEnabled: true
      }
    ],
    sectionLeaderBindings: [],
    groupLeaderBindings: [],
    reviewGroups: [{ id: 'group-1', name: '信息化组', isActive: true, memberCount: 1, quotas: [] }],
    goalTemplates: [
      {
        id: 'template-1',
        departmentId: 'dept-1',
        name: '平台科新员工模板',
        description: null,
        isActive: true,
        keyResults: [
          {
            id: 'template-kr-1',
            code: 'KR1',
            name: '完成季度首个版本交付',
            description: null,
            points: 30,
            scoreType: 'objective'
          }
        ]
      }
    ]
  };
}

describe('admin org form helpers', () => {
  it('summarizes admin bootstrap counts', () => {
    const result = summarizeBootstrap(createBootstrap());

    expect(result).toEqual({
      departmentCount: 1,
      sectionCount: 1,
      userCount: 1,
      reviewGroupCount: 1,
      localAccountCount: 1,
      roleAssignmentCount: 1
    });
  });

  it('creates review groups with five fixed quota grades', () => {
    const reviewGroup = createReviewGroupRecord();

    expect(reviewGroup.quotas.map((quota) => quota.gradeCode)).toEqual(['A+', 'A', 'B', 'C', 'D']);
    expect(totalQuotaSeats(reviewGroup)).toBe(0);
  });

  it('creates a saveable default goal template draft', () => {
    const template = createGoalTemplateRecord('dept-1');

    expect(template.departmentId).toBe('dept-1');
    expect(template.name).toBe('新模板目标');
    expect(template.keyResults).toHaveLength(1);
    expect(template.keyResults[0]).toMatchObject({
      code: 'KR1',
      name: '关键结果1',
      points: 0
    });
  });

  it('derives role scope automatically from role and user', () => {
    expect(
      applyDerivedRoleAssignmentScope({
        id: 'role-2',
        userId: 'user-2',
        roleCode: 'employee',
        scopeType: 'section',
        scopeId: 'legacy',
        isPrimary: true,
        isEnabled: true
      })
    ).toMatchObject({
      scopeType: 'user',
      scopeId: 'user-2'
    });

    expect(
      applyDerivedRoleAssignmentScope({
        id: 'role-3',
        userId: 'user-3',
        roleCode: 'group-leader',
        scopeType: 'user',
        scopeId: 'legacy',
        isPrimary: false,
        isEnabled: true
      })
    ).toMatchObject({
      scopeType: 'review-group',
      scopeId: 'managed-group:user-3'
    });
  });

  it('builds save payload from dirty sections only and keeps untouched template data', () => {
    const bootstrap = createBootstrap();
    const draft: AdminOrgBootstrapInput = {
      ...bootstrap,
      goalTemplates: [
        {
          ...bootstrap.goalTemplates[0],
          keyResults: [
            {
              ...bootstrap.goalTemplates[0].keyResults[0],
              points: Number.NaN
            }
          ]
        }
      ],
      roleAssignments: [
        {
          id: 'role-1',
          userId: 'user-1',
          roleCode: 'employee',
          scopeType: 'section',
          scopeId: 'legacy',
          isPrimary: true,
          isEnabled: true
        }
      ]
    };

    const payload = buildAdminBootstrapSaveInput(bootstrap, draft, ['access']);

    expect(payload.goalTemplates[0].keyResults[0].points).toBe(30);
    expect(payload.roleAssignments[0]).toMatchObject({
      roleCode: 'employee',
      scopeType: 'user',
      scopeId: 'user-1'
    });
  });

  it('normalizes invalid review quota and template points inside dirty sections', () => {
    const bootstrap = createBootstrap();
    const draft: AdminOrgBootstrapInput = {
      ...bootstrap,
      reviewGroups: [
        {
          id: 'group-1',
          name: '信息化组',
          isActive: true,
          quotas: [
            { gradeCode: 'A+', seatCount: Number.NaN },
            { gradeCode: 'A', seatCount: 1.8 },
            { gradeCode: 'B', seatCount: -1 },
            { gradeCode: 'C', seatCount: 0 },
            { gradeCode: 'D', seatCount: 0 }
          ]
        }
      ],
      goalTemplates: [
        {
          ...bootstrap.goalTemplates[0],
          keyResults: [
            {
              ...bootstrap.goalTemplates[0].keyResults[0],
              points: Number.NaN
            }
          ]
        }
      ]
    };

    const payload = buildAdminBootstrapSaveInput(bootstrap, draft, ['review-groups', 'goal-templates']);

    expect(payload.reviewGroups[0].quotas.map((quota) => quota.seatCount)).toEqual([0, 1, 0, 0, 0]);
    expect(payload.goalTemplates[0].keyResults[0].points).toBe(0);
  });

  it('falls back to actual diff detection when dirty section state lags behind', () => {
    const bootstrap = createBootstrap();
    const draft: AdminOrgBootstrapInput = {
      ...bootstrap,
      reviewGroups: [
        {
          id: 'group-1',
          name: '淇℃伅鍖栫粍',
          isActive: true,
          quotas: [
            { gradeCode: 'A+', seatCount: 1 },
            { gradeCode: 'A', seatCount: 1 },
            { gradeCode: 'B', seatCount: 1 },
            { gradeCode: 'C', seatCount: 0 },
            { gradeCode: 'D', seatCount: 0 }
          ]
        }
      ]
    };

    const payload = buildAdminBootstrapSaveInput(bootstrap, draft, []);

    expect(payload.reviewGroups[0].quotas).toEqual([
      { gradeCode: 'A+', seatCount: 1 },
      { gradeCode: 'A', seatCount: 1 },
      { gradeCode: 'B', seatCount: 1 },
      { gradeCode: 'C', seatCount: 0 },
      { gradeCode: 'D', seatCount: 0 }
    ]);
  });

  it('rolls review group quotas back to the last persisted bootstrap after a failed save', () => {
    const bootstrap = createBootstrap();
    const draft: AdminOrgBootstrapInput = {
      ...bootstrap,
      reviewGroups: [
        {
          id: 'group-1',
          name: '淇℃伅鍖栫粍',
          isActive: true,
          quotas: [
            { gradeCode: 'A+', seatCount: 2 },
            { gradeCode: 'A', seatCount: 3 },
            { gradeCode: 'B', seatCount: 1 },
            { gradeCode: 'C', seatCount: 0 },
            { gradeCode: 'D', seatCount: 0 }
          ]
        }
      ]
    };

    const rolledBack = rollbackAdminBootstrapDraft(bootstrap, draft);

    expect(rolledBack.reviewGroups[0].quotas).toEqual(bootstrap.reviewGroups[0].quotas);
  });

  it('prunes orphaned user references after deleting a user from the draft', () => {
    const bootstrap = createBootstrap();
    const draft: AdminOrgBootstrapInput = {
      ...bootstrap,
      users: [],
      localAccounts: [{ userId: 'user-1', loginName: 'sysadmin.local', localLoginEnabled: true, password: '' }],
      roleAssignments: [
        {
          id: 'role-1',
          userId: 'user-1',
          roleCode: 'system-admin',
          scopeType: 'system',
          scopeId: 'system',
          isPrimary: true,
          isEnabled: true
        }
      ],
      sectionLeaderBindings: [{ id: 'section-binding-1', leaderUserId: 'user-1', sectionId: 'section-1' }],
      groupLeaderBindings: [{ id: 'group-binding-1', leaderUserId: 'user-1', reviewGroupId: 'group-1' }]
    };

    const sanitized = sanitizeBootstrapDraft(draft);

    expect(sanitized.localAccounts).toEqual([]);
    expect(sanitized.roleAssignments).toEqual([]);
    expect(sanitized.sectionLeaderBindings).toEqual([]);
    expect(sanitized.groupLeaderBindings).toEqual([]);
  });

  it('derives a single primary role automatically from enabled role priority when building save payload', () => {
    const bootstrap = createBootstrap();
    const draft: AdminOrgBootstrapInput = {
      ...bootstrap,
      roleAssignments: [
        {
          id: 'role-employee',
          userId: 'user-1',
          roleCode: 'employee',
          scopeType: 'user',
          scopeId: 'legacy',
          isPrimary: true,
          isEnabled: true
        },
        {
          id: 'role-section',
          userId: 'user-1',
          roleCode: 'section-leader',
          scopeType: 'section',
          scopeId: 'legacy',
          isPrimary: false,
          isEnabled: true
        }
      ]
    };

    const payload = buildAdminBootstrapSaveInput(bootstrap, draft, ['access']);

    expect(payload.roleAssignments).toEqual([
      expect.objectContaining({
        id: 'role-employee',
        roleCode: 'employee',
        scopeType: 'user',
        scopeId: 'user-1',
        isPrimary: false
      }),
      expect.objectContaining({
        id: 'role-section',
        roleCode: 'section-leader',
        scopeType: 'section',
        scopeId: 'managed-section:user-1',
        isPrimary: true
      })
    ]);
  });
});
