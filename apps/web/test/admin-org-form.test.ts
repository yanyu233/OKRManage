import { describe, expect, it } from 'vitest';
import { createReviewGroupRecord, summarizeBootstrap, totalQuotaSeats } from '../src/modules/admin/admin-org-form';
import type { AdminOrgBootstrap } from '../src/shared/types/admin-config';

describe('admin org form helpers', () => {
  it('summarizes admin bootstrap counts', () => {
    const result = summarizeBootstrap({
      departments: [{ id: 'd-1', name: '工业互联网中心', isActive: true }],
      sections: [{ id: 's-1', departmentId: 'd-1', name: '平台产品科', isActive: true }],
      users: [
        {
          id: 'u-1',
          employeeNo: '1001',
          name: '严主任',
          departmentId: 'd-1',
          sectionId: 's-1',
          reviewGroupId: 'rg-1',
          isActive: true
        }
      ],
      localAccounts: [{ userId: 'u-1', loginName: 'sysadmin.local', localLoginEnabled: true }],
      roleAssignments: [
        {
          id: 'ra-1',
          userId: 'u-1',
          roleCode: 'system-admin',
          scopeType: 'system',
          scopeId: 'system',
          isPrimary: true,
          isEnabled: true
        }
      ],
      sectionLeaderBindings: [],
      groupLeaderBindings: [],
      reviewGroups: [{ id: 'rg-1', name: '信息化组', isActive: true, memberCount: 1, quotas: [] }]
    } satisfies AdminOrgBootstrap);

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

    expect(reviewGroup.quotas.map((quota) => quota.gradeCode)).toEqual(['A+', 'A', 'B+', 'B', 'C']);
    expect(totalQuotaSeats(reviewGroup)).toBe(0);
  });
});
