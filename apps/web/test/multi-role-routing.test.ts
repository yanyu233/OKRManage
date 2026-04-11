import { describe, expect, it } from 'vitest';
import {
  buildNavigationSections,
  canAccessRoute,
  resolveTargetRoleForPath,
  selectedMenuKeyForPath
} from '../src/modules/layout/routing';
import type { SessionUser } from '../src/shared/types/session';

const employeeUser: SessionUser = {
  id: 'u-employee',
  name: '张晨',
  role: 'employee',
  activeRole: 'employee',
  roles: [
    {
      role: 'employee',
      isPrimary: true
    }
  ],
  loginName: 'zhangchen'
};

const dualRoleUser: SessionUser = {
  id: 'u-dual',
  name: '马组长',
  role: 'group-leader',
  activeRole: 'group-leader',
  roles: [
    {
      role: 'group-leader',
      isPrimary: true
    },
    {
      role: 'employee',
      isPrimary: false
    }
  ],
  loginName: 'group.leader'
};

describe('multi-role routing', () => {
  it('builds a single employee menu section for employee-only users', () => {
    const sections = buildNavigationSections(employeeUser);

    expect(sections).toEqual([
      {
        role: 'employee',
        title: '员工',
        items: [
          {
            key: '/employee/okr',
            label: '我的 OKR',
            role: 'employee'
          }
        ]
      }
    ]);
  });

  it('builds grouped leader and employee sections for dual-role users', () => {
    const sections = buildNavigationSections(dualRoleUser);

    expect(sections).toEqual([
      {
        role: 'group-leader',
        title: '小组负责人',
        items: [
          {
            key: '/leader/workbench',
            label: '评分工作台',
            role: 'group-leader'
          },
          {
            key: '/leader/ranking',
            label: '评分排名',
            role: 'group-leader'
          }
        ]
      },
      {
        role: 'employee',
        title: '员工',
        items: [
          {
            key: '/employee/okr',
            label: '我的 OKR',
            role: 'employee'
          }
        ]
      }
    ]);
  });

  it('resolves target active role from the destination path', () => {
    expect(resolveTargetRoleForPath(dualRoleUser, '/employee/okr')).toBe('employee');
    expect(resolveTargetRoleForPath(dualRoleUser, '/employee/goal/goal-1')).toBe('employee');
    expect(resolveTargetRoleForPath(dualRoleUser, '/leader/workbench')).toBe('group-leader');
  });

  it('checks route access from assigned roles instead of only the active role', () => {
    expect(canAccessRoute(dualRoleUser, ['employee'])).toBe(true);
    expect(canAccessRoute(dualRoleUser, ['group-leader'])).toBe(true);
    expect(canAccessRoute(dualRoleUser, ['system-admin'])).toBe(false);
  });

  it('maps nested employee routes to the employee menu key', () => {
    expect(selectedMenuKeyForPath('/employee/goal/goal-1')).toBe('/employee/okr');
    expect(selectedMenuKeyForPath('/leader/ranking')).toBe('/leader/ranking');
  });
});
