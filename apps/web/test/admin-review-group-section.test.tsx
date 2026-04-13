import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewGroupSection } from '../src/modules/admin/AdminOrgLeaderSections';
import type { AdminOrgBootstrapInput } from '../src/shared/types/admin-config';

window.matchMedia ??= vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn()
}));

describe('ReviewGroupSection', () => {
  it('updates quota state immediately when a seat count changes', async () => {
    const draft: AdminOrgBootstrapInput = {
      departments: [],
      sections: [],
      users: [
        {
          id: 'user-1',
          employeeNo: '1001',
          name: '严主任',
          departmentId: null,
          sectionId: null,
          reviewGroupId: 'group-1',
          isActive: true
        }
      ],
      localAccounts: [],
      roleAssignments: [],
      sectionLeaderBindings: [],
      groupLeaderBindings: [],
      reviewGroups: [
        {
          id: 'group-1',
          name: '信息化组',
          isActive: true,
          quotas: [
            { gradeCode: 'A+', seatCount: 0 },
            { gradeCode: 'A', seatCount: 0 },
            { gradeCode: 'B', seatCount: 0 },
            { gradeCode: 'C', seatCount: 0 },
            { gradeCode: 'D', seatCount: 0 }
          ]
        }
      ],
      goalTemplates: []
    };

    const updateReviewGroup = vi.fn();

    render(
      <ReviewGroupSection
        draft={draft}
        updateCollection={vi.fn()}
        memberCountByReviewGroup={new Map([['group-1', 1]])}
        updateReviewGroup={updateReviewGroup}
      />
    );

    const quotaInputs = await screen.findAllByRole('spinbutton');
    fireEvent.change(quotaInputs[0], { target: { value: '1' } });

    expect(updateReviewGroup).toHaveBeenCalledWith('group-1', {
      quotas: [
        { gradeCode: 'A+', seatCount: 1 },
        { gradeCode: 'A', seatCount: 0 },
        { gradeCode: 'B', seatCount: 0 },
        { gradeCode: 'C', seatCount: 0 },
        { gradeCode: 'D', seatCount: 0 }
      ]
    });
  });
});
