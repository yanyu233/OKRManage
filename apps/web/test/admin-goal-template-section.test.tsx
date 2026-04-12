import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminGoalTemplateSection } from '../src/modules/admin/AdminGoalTemplateSection';
import type { AdminOrgBootstrapInput } from '../src/shared/types/admin-config';

describe('AdminGoalTemplateSection', () => {
  it('renders template controls and department binding', () => {
    const draft: AdminOrgBootstrapInput = {
      departments: [{ id: 'dept-1', name: '工业互联网中心', isActive: true }],
      sections: [],
      users: [],
      localAccounts: [],
      roleAssignments: [],
      sectionLeaderBindings: [],
      groupLeaderBindings: [],
      reviewGroups: [],
      goalTemplates: []
    };

    render(<AdminGoalTemplateSection draft={draft} updateCollection={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '模板目标' })).toBeTruthy();
    expect(screen.getByText('新增模板')).toBeTruthy();
    expect(screen.getByText('全部部门')).toBeTruthy();
  });

  it('shows score type control for template key results', () => {
    const draft: AdminOrgBootstrapInput = {
      departments: [{ id: 'dept-1', name: '工业互联网中心', isActive: true }],
      sections: [],
      users: [],
      localAccounts: [],
      roleAssignments: [],
      sectionLeaderBindings: [],
      groupLeaderBindings: [],
      reviewGroups: [],
      goalTemplates: [
        {
          id: 'template-1',
          departmentId: 'dept-1',
          name: '平台模板',
          description: null,
          isActive: true,
          keyResults: [
            {
              id: 'kr-1',
              code: 'KR1',
              name: '模板 KR',
              description: null,
              points: 20,
              scoreType: 'subjective'
            }
          ]
        }
      ]
    };

    render(<AdminGoalTemplateSection draft={draft} updateCollection={vi.fn()} />);

    expect(screen.getByText('评分类型')).toBeTruthy();
    expect(screen.getByText('主观评分项')).toBeTruthy();
  });
});
