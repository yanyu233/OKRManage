import {
  ApartmentOutlined,
  BarChartOutlined,
  BookOutlined,
  FundOutlined,
  HistoryOutlined,
  ProfileOutlined,
  SettingOutlined,
  TeamOutlined
} from '@ant-design/icons';
import type { ItemType } from 'antd/es/menu/interface';
import type { ReactNode } from 'react';
import { getRoleLabel } from '../../shared/i18n/labels';
import type { SessionUser, UserRole } from '../../shared/types/session';

type NavigationLink = {
  key: string;
  label: string;
  role: UserRole;
};

export type NavigationSection = {
  role: UserRole;
  title: string;
  items: NavigationLink[];
};

const COMMON_ITEMS: NavigationLink[] = [
  {
    key: '/okr/all',
    label: '全部OKR',
    role: 'employee'
  },
  {
    key: '/knowledge-base',
    label: '知识库',
    role: 'employee'
  }
];

const ADMIN_ITEMS: NavigationLink[] = [
  {
    key: '/admin/org',
    label: '系统配置',
    role: 'system-admin'
  },
  {
    key: '/admin/historical-performance',
    label: '历史绩效补录',
    role: 'system-admin'
  },
  {
    key: '/leader/ranking',
    label: '评分排名',
    role: 'system-admin'
  },
  {
    key: '/leader/annual-ranking',
    label: '年度评分排名',
    role: 'system-admin'
  }
];

const OBJECTIVE_WORKBENCH_ITEM: NavigationLink = {
  key: '/leader/workbench/objective',
  label: '客观项评分工作台',
  role: 'group-leader'
};

const SUBJECTIVE_WORKBENCH_ITEM: NavigationLink = {
  key: '/leader/workbench/subjective',
  label: '主观项评分工作台',
  role: 'section-leader'
};

const LEADER_RESULT_ITEMS: NavigationLink[] = [
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
];

const EMPLOYEE_ITEMS: NavigationLink[] = [
  {
    key: '/employee/okr',
    label: '我的OKR',
    role: 'employee'
  }
];

const DEPARTMENT_HEAD_ITEMS: NavigationLink[] = [
  {
    key: '/leader/workbench/objective',
    label: '客观项评分工作台',
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
];

const MENU_ICONS: Record<string, ReactNode> = {
  '/admin/org': <SettingOutlined />,
  '/admin/historical-performance': <HistoryOutlined />,
  '/leader/workbench/objective': <TeamOutlined />,
  '/leader/workbench/subjective': <TeamOutlined />,
  '/leader/ranking': <BarChartOutlined />,
  '/leader/annual-ranking': <FundOutlined />,
  '/knowledge-base': <BookOutlined />,
  '/okr/all': <ProfileOutlined />,
  '/employee/okr': <ApartmentOutlined />
};

export function defaultPathForRole(role: UserRole) {
  switch (role) {
    case 'system-admin':
      return '/admin/org';
    case 'department-head':
      return '/leader/workbench/objective';
    case 'section-leader':
      return '/leader/workbench/subjective';
    case 'group-leader':
      return '/leader/workbench/objective';
    case 'employee':
    default:
      return '/employee/okr';
  }
}

export function resolvePostAuthPath(user: SessionUser, returnTo?: string | null) {
  const normalizedReturnTo = normalizeReturnTo(returnTo);
  if (!normalizedReturnTo) {
    return defaultPathForRole(user.activeRole);
  }

  const targetRole = resolveTargetRoleForPath(user, normalizedReturnTo);
  if (targetRole && canAccessRoute(user, [targetRole])) {
    return normalizedReturnTo;
  }

  return defaultPathForRole(user.activeRole);
}

export function buildNavigationSections(user: SessionUser): NavigationSection[] {
  const roles = getAssignedRoles(user);
  const sections: NavigationSection[] = [];

  if (roles.includes('system-admin')) {
    sections.push({
      role: 'system-admin',
      title: getRoleLabel('system-admin'),
      items: ADMIN_ITEMS
    });
  }

  if (roles.includes('department-head')) {
    sections.push({
      role: 'department-head',
      title: getRoleLabel('department-head'),
      items: DEPARTMENT_HEAD_ITEMS
    });
    return sections;
  }

  if (hasLeaderCapability(roles)) {
    sections.push({
      role: roles.includes('group-leader') ? 'group-leader' : 'section-leader',
      title: '科室负责人 / 小组负责人',
      items: buildLeaderItems(roles)
    });
  }

  if (roles.includes('employee')) {
    sections.push({
      role: 'employee',
      title: getRoleLabel('employee'),
      items: EMPLOYEE_ITEMS
    });
  }

  return sections;
}

export function menuItemsForUser(user: SessionUser): ItemType[] {
  const sections = buildNavigationSections(user);
  const commonItems = COMMON_ITEMS.map(toMenuItem);

  if (sections.length <= 1) {
    return [...commonItems, ...(sections[0]?.items ?? []).map(toMenuItem)];
  }

  return [
    ...commonItems,
    ...sections.map((section) => ({
      type: 'group' as const,
      key: `group:${section.role}`,
      label: section.title,
      children: section.items.map(toMenuItem)
    }))
  ];
}

export function selectedMenuKeyForPath(pathname: string) {
  if (pathname.startsWith('/okr/all')) {
    return '/okr/all';
  }

  if (pathname.startsWith('/admin/historical-performance')) {
    return '/admin/historical-performance';
  }

  if (pathname.startsWith('/admin/')) {
    return '/admin/org';
  }

  if (pathname.startsWith('/leader/workbench/subjective')) {
    return '/leader/workbench/subjective';
  }

  if (pathname.startsWith('/leader/workbench/objective') || pathname === '/leader/workbench') {
    return '/leader/workbench/objective';
  }

  if (pathname.startsWith('/leader/annual-ranking')) {
    return '/leader/annual-ranking';
  }

  if (pathname.startsWith('/knowledge-base') || pathname.startsWith('/leader/knowledge-base')) {
    return '/knowledge-base';
  }

  if (pathname.startsWith('/leader/ranking')) {
    return '/leader/ranking';
  }

  if (pathname.startsWith('/employee/goal/')) {
    return '/employee/okr';
  }

  if (pathname.startsWith('/employee/')) {
    return '/employee/okr';
  }

  return pathname;
}

export function canAccessRoute(user: SessionUser, allow: UserRole[]) {
  return getAssignedRoles(user).some((role) => allow.includes(role));
}

export function resolveTargetRoleForPath(user: SessionUser, pathname: string): UserRole | null {
  const roles = getAssignedRoles(user);

  if (pathname.startsWith('/admin/')) {
    return roles.includes('system-admin') ? 'system-admin' : null;
  }

  if (pathname.startsWith('/proofs/archive/')) {
    if (isProofViewerRole(user.activeRole)) {
      return user.activeRole;
    }

    if (roles.includes('employee')) {
      return 'employee';
    }

    if (roles.includes('department-head')) {
      return 'department-head';
    }

    if (roles.includes('group-leader')) {
      return 'group-leader';
    }

    if (roles.includes('section-leader')) {
      return 'section-leader';
    }

    return roles.includes('system-admin') ? 'system-admin' : null;
  }

  if (pathname.startsWith('/knowledge-base') || pathname.startsWith('/leader/knowledge-base')) {
    if (user.activeRole === 'section-leader' || user.activeRole === 'group-leader') {
      return user.activeRole;
    }

    if (roles.includes('section-leader')) {
      return 'section-leader';
    }

    if (roles.includes('group-leader')) {
      return 'group-leader';
    }

    if (roles.includes('department-head')) {
      return 'department-head';
    }

    if (roles.includes('employee')) {
      return 'employee';
    }

    return roles.includes('system-admin') ? 'system-admin' : user.activeRole;
  }

  if (pathname.startsWith('/okr/all')) {
    return user.activeRole;
  }

  if (pathname.startsWith('/employee/')) {
    if (user.activeRole === 'employee' || user.activeRole === 'department-head') {
      return user.activeRole;
    }

    if (roles.includes('department-head')) {
      return 'department-head';
    }

    return roles.includes('employee') ? 'employee' : null;
  }

  if (pathname.startsWith('/leader/workbench/subjective')) {
    if (user.activeRole === 'section-leader') {
      return 'section-leader';
    }

    return roles.includes('section-leader') ? 'section-leader' : null;
  }

  if (pathname.startsWith('/leader/workbench/objective') || pathname === '/leader/workbench') {
    if (user.activeRole === 'department-head' || user.activeRole === 'section-leader' || user.activeRole === 'group-leader') {
      return user.activeRole;
    }

    if (roles.includes('department-head')) {
      return 'department-head';
    }

    if (roles.includes('group-leader')) {
      return 'group-leader';
    }

    if (roles.includes('section-leader')) {
      return 'section-leader';
    }

    return null;
  }

  if (pathname.startsWith('/leader/ranking') || pathname.startsWith('/leader/annual-ranking')) {
    if (
      user.activeRole === 'department-head' ||
      user.activeRole === 'section-leader' ||
      user.activeRole === 'group-leader' ||
      user.activeRole === 'system-admin'
    ) {
      return user.activeRole;
    }

    if (roles.includes('system-admin')) {
      return 'system-admin';
    }

    if (roles.includes('department-head')) {
      return 'department-head';
    }

    if (roles.includes('group-leader')) {
      return 'group-leader';
    }

    if (roles.includes('section-leader')) {
      return 'section-leader';
    }
  }

  return null;
}

function getAssignedRoles(user: SessionUser): UserRole[] {
  const roles = user.roles.map((item) => item.role);

  if (!roles.includes(user.activeRole)) {
    roles.unshift(user.activeRole);
  }

  if (!roles.includes(user.role)) {
    roles.unshift(user.role);
  }

  return Array.from(new Set(roles));
}

function normalizeReturnTo(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized.startsWith('/') || normalized.startsWith('//')) {
    return null;
  }

  return normalized;
}

function hasLeaderCapability(roles: UserRole[]) {
  return roles.includes('department-head') || roles.includes('section-leader') || roles.includes('group-leader');
}

function isProofViewerRole(role: UserRole) {
  return ['employee', 'department-head', 'section-leader', 'group-leader', 'system-admin'].includes(role);
}

function buildLeaderItems(roles: UserRole[]) {
  const items: NavigationLink[] = [OBJECTIVE_WORKBENCH_ITEM, ...LEADER_RESULT_ITEMS];

  if (roles.includes('section-leader')) {
    items.unshift(SUBJECTIVE_WORKBENCH_ITEM);
  }

  return items;
}

function toMenuItem(item: NavigationLink): ItemType {
  return {
    key: item.key,
    label: item.label,
    icon: MENU_ICONS[item.key]
  };
}
