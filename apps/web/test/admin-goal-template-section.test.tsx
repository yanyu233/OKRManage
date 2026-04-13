import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminGoalTemplateSection } from '../src/modules/admin/AdminGoalTemplateSection';
import type { AdminOrgBootstrapInput } from '../src/shared/types/admin-config';

function createDraft(): AdminOrgBootstrapInput {
  return {
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
}

describe('AdminGoalTemplateSection', () => {
  it('renders template controls and department binding', () => {
    render(<AdminGoalTemplateSection draft={createDraft()} updateCollection={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '\u6a21\u677f\u76ee\u6807' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /新增模板/ })).toBeTruthy();
    expect(screen.getByText('\u5168\u90e8\u90e8\u95e8')).toBeTruthy();
  });

  it('creates a saveable template draft with default template and key result names', () => {
    const draft = createDraft();
    let nextTemplates = draft.goalTemplates;
    const updateCollection = vi.fn((key, updater) => {
      if (key === 'goalTemplates') {
        nextTemplates = updater(draft.goalTemplates);
      }
    });

    render(<AdminGoalTemplateSection draft={draft} updateCollection={updateCollection} />);

    fireEvent.click(screen.getByRole('button', { name: /新增模板/ }));

    expect(nextTemplates).toHaveLength(1);
    expect(nextTemplates[0]).toMatchObject({
      departmentId: 'dept-1',
      name: '\u65b0\u6a21\u677f\u76ee\u68071'
    });
    expect(nextTemplates[0].keyResults[0]).toMatchObject({
      code: 'KR1',
      name: '\u5173\u952e\u7ed3\u679c1',
      points: 0
    });
  });

  it('shows score type control for template key results', () => {
    const draft: AdminOrgBootstrapInput = {
      ...createDraft(),
      goalTemplates: [
        {
          id: 'template-1',
          departmentId: 'dept-1',
          name: '\u5e73\u53f0\u6a21\u677f',
          description: null,
          isActive: true,
          keyResults: [
            {
              id: 'kr-1',
              code: 'KR1',
              name: '\u6a21\u677f\u5173\u952e\u7ed3\u679c',
              description: null,
              points: 20,
              scoreType: 'subjective'
            }
          ]
        }
      ]
    };

    render(<AdminGoalTemplateSection draft={draft} updateCollection={vi.fn()} />);

    expect(screen.getByText('\u8bc4\u5206\u7c7b\u578b')).toBeTruthy();
    expect(screen.getByText('\u4e3b\u89c2\u8bc4\u5206\u9879')).toBeTruthy();
  });
});
