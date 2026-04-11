import { ApartmentOutlined, BarChartOutlined, SettingOutlined, TeamOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { ItemType } from 'antd/es/menu/interface';
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

const ROLE_LINKS: Record<UserRole, NavigationLink[]> = {
  'system-admin': [
    {
      key: '/admin/org',
      label: '系统配置',
      role: 'system-admin'
    }
  ],
  'section-leader': [
    {
      key: '/leader/workbench',
      label: '评分工作台',
      role: 'section-leader'
    },
    {
      key: '/leader/ranking',
      label: '评分排名',
      role: 'section-leader'
    }
  ],
  'group-leader': [
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
  ],
  employee: [
    {
      key: '/employee/okr',
      label: '我的 OKR',
      role: 'employee'
    }
  ]
};

const MENU_ICONS: Record<string, ReactNode> = {
  '/admin/org': <SettingOutlined />,
  '/leader/workbench': <TeamOutlined />,
  '/leader/ranking': <BarChartOutlined />,
  '/employee/okr': <ApartmentOutlined />
};

export function defaultPathForRole(role: UserRole) {
  switch (role) {
    case 'system-admin':
      return '/admin/org';
    case 'section-leader':
    case 'group-leader':
      return '/leader/workbench';
    case 'employee':
    default:
      return '/employee/okr';
  }
}

export function buildNavigationSections(user: SessionUser): NavigationSection[] {
  return getAssignedRoles(user).map((role) => ({
    role,
    title: getRoleLabel(role),
    items: ROLE_LINKS[role]
  }));
}

export function menuItemsForUser(user: SessionUser): ItemType[] {
  const sections = buildNavigationSections(user);

  if (sections.length <= 1) {
    return (sections[0]?.items ?? []).map(toMenuItem);
  }

  return sections.map((section) => ({
    type: 'group' as const,
    key: `group:${section.role}`,
    label: section.title,
    children: section.items.map(toMenuItem)
  }));
}

export function selectedMenuKeyForPath(pathname: string) {
  if (pathname.startsWith('/admin/')) {
    return '/admin/org';
  }

  if (pathname.startsWith('/leader/ranking')) {
    return '/leader/ranking';
  }

  if (pathname.startsWith('/leader/')) {
    return '/leader/workbench';
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
  if (pathname.startsWith('/admin/')) {
    return getAssignedRoles(user).includes('system-admin') ? 'system-admin' : null;
  }

  if (pathname.startsWith('/employee/')) {
    return getAssignedRoles(user).includes('employee') ? 'employee' : null;
  }

  if (pathname.startsWith('/leader/')) {
    if (user.activeRole === 'section-leader' || user.activeRole === 'group-leader') {
      return user.activeRole;
    }

    return getAssignedRoles(user).find((role) => role === 'section-leader' || role === 'group-leader') ?? null;
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

function toMenuItem(item: NavigationLink): ItemType {
  return {
    key: item.key,
    label: item.label,
    icon: MENU_ICONS[item.key]
  };
}
