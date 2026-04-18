import { describe, expect, it } from 'vitest';
import {
  buildNavigationSections,
  canAccessRoute,
  menuItemsForUser,
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

const departmentHeadUser: SessionUser = {
  id: 'u-dept',
  name: '赵部长',
  role: 'department-head',
  activeRole: 'department-head',
  roles: [
    {
      role: 'department-head',
      isPrimary: true
    }
  ],
  loginName: 'department.head'
};

describe('multi-role routing', () => {
  it('builds a single employee section for employee-only users', () => {
    const sections = buildNavigationSections(employeeUser);

    expect(sections).toEqual([
      {
        role: 'employee',
        title: '员工',
        items: [
          {
            key: '/employee/okr',
            label: '我的OKR',
            role: 'employee'
          }
        ]
      }
    ]);
  });

  it('merges leader capabilities into one section and keeps employee menu for dual-role users', () => {
    const sections = buildNavigationSections(dualRoleUser);
    const items = menuItemsForUser(dualRoleUser);

    expect(sections).toEqual([
      {
        role: 'group-leader',
        title: '科室负责人/小组负责人',
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
          },
          {
            key: '/leader/annual-ranking',
            label: '年度评分排名',
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
            label: '我的OKR',
            role: 'employee'
          }
        ]
      }
    ]);

    expect(items).toHaveLength(4);
    expect((items[0] as { key?: string }).key).toBe('/okr/all');
    expect((items[1] as { key?: string }).key).toBe('/knowledge-base');
    const totalChildren = items.reduce((sum, item) => sum + ((item as { children?: unknown[] }).children?.length ?? 1), 0);
    expect(totalChildren).toBe(6);
  });

  it('shows all non-admin menus for department head', () => {
    const sections = buildNavigationSections(departmentHeadUser);
    const items = menuItemsForUser(departmentHeadUser);

    expect(sections).toEqual([
      {
        role: 'department-head',
        title: '部门负责人',
        items: [
          {
            key: '/leader/workbench',
            label: '评分工作台',
            role: 'department-head'
          },
          {
            key: '/leader/ranking',
            label: '评分排名',
            role: 'department-head'
          },
          {
            key: '/leader/annual-ranking',
            label: '年度评分排名',
            role: 'department-head'
          },
          {
            key: '/employee/okr',
            label: '我的OKR',
            role: 'department-head'
          }
        ]
      }
    ]);

    expect(items).toHaveLength(6);
    expect((items[0] as { key?: string }).key).toBe('/okr/all');
    expect((items[1] as { key?: string }).key).toBe('/knowledge-base');
    expect((items[5] as { key?: string }).key).toBe('/employee/okr');
  });

  it('resolves target active role from the destination path', () => {
    expect(resolveTargetRoleForPath(dualRoleUser, '/employee/okr')).toBe('employee');
    expect(resolveTargetRoleForPath(dualRoleUser, '/employee/goal/goal-1')).toBe('employee');
    expect(resolveTargetRoleForPath(dualRoleUser, '/leader/workbench')).toBe('group-leader');
    expect(resolveTargetRoleForPath(dualRoleUser, '/leader/annual-ranking')).toBe('group-leader');
    expect(resolveTargetRoleForPath(dualRoleUser, '/leader/knowledge-base')).toBe('group-leader');
    expect(resolveTargetRoleForPath(dualRoleUser, '/knowledge-base')).toBe('group-leader');

    expect(resolveTargetRoleForPath(departmentHeadUser, '/employee/okr')).toBe('department-head');
    expect(resolveTargetRoleForPath(departmentHeadUser, '/leader/workbench')).toBe('department-head');
  });

  it('checks route access from assigned roles instead of only the active role', () => {
    expect(canAccessRoute(dualRoleUser, ['employee'])).toBe(true);
    expect(canAccessRoute(dualRoleUser, ['group-leader'])).toBe(true);
    expect(canAccessRoute(dualRoleUser, ['system-admin'])).toBe(false);
    expect(canAccessRoute(departmentHeadUser, ['department-head'])).toBe(true);
  });

  it('maps nested employee routes to the employee menu key', () => {
    expect(selectedMenuKeyForPath('/employee/goal/goal-1')).toBe('/employee/okr');
    expect(selectedMenuKeyForPath('/leader/ranking')).toBe('/leader/ranking');
    expect(selectedMenuKeyForPath('/leader/annual-ranking')).toBe('/leader/annual-ranking');
    expect(selectedMenuKeyForPath('/leader/knowledge-base')).toBe('/knowledge-base');
    expect(selectedMenuKeyForPath('/knowledge-base')).toBe('/knowledge-base');
  });
});
