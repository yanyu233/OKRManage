import { ApartmentOutlined, BarChartOutlined, SettingOutlined, TeamOutlined } from '@ant-design/icons';
import type { ItemType } from 'antd/es/menu/interface';
import type { UserRole } from '../../shared/types/session';

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

export function menuItemsForRole(role: UserRole): ItemType[] {
  if (role === 'system-admin') {
    return [
      {
        key: '/admin/org',
        icon: <SettingOutlined />,
        label: 'Admin Console'
      }
    ];
  }

  if (role === 'section-leader' || role === 'group-leader') {
    return [
      {
        key: '/leader/workbench',
        icon: <TeamOutlined />,
        label: 'Scoring Workbench'
      },
      {
        key: '/leader/ranking',
        icon: <BarChartOutlined />,
        label: 'Score Ranking'
      }
    ];
  }

  return [
    {
      key: '/employee/okr',
      icon: <ApartmentOutlined />,
      label: 'My OKR'
    }
  ];
}
