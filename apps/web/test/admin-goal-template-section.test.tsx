import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminGoalTemplateSection } from '../src/modules/admin/AdminGoalTemplateSection';
import type { AdminOrgBootstrapInput } from '../src/shared/types/admin-config';

describe('AdminGoalTemplateSection', () => {
  it('renders template controls and department binding', () => {
    const draft: AdminOrgBootstrapInput = {
      departments: [{ id: 'dept-1', name: '\u5de5\u4e1a\u4e92\u8054\u7f51\u4e2d\u5fc3', isActive: true }],
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

    expect(screen.getByRole('heading', { name: '\u6a21\u677f\u76ee\u6807' })).toBeTruthy();
    expect(screen.getByText('\u65b0\u589e\u6a21\u677f')).toBeTruthy();
    expect(screen.getByText('\u5168\u90e8\u90e8\u95e8')).toBeTruthy();
  });
});
