import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessSections } from '../src/modules/admin/AdminOrgAccessSections';
import type { AdminOrgBootstrapInput } from '../src/shared/types/admin-config';

function AccessSectionsHarness({ initialDraft }: { initialDraft: AdminOrgBootstrapInput }) {
  const [draft, setDraft] = useState(initialDraft);

  return (
    <AccessSections
      draft={draft}
      updateCollection={(key, updater) => {
        setDraft((current) => ({ ...current, [key]: updater(current[key]) }));
      }}
    />
  );
}

function createDraft(): AdminOrgBootstrapInput {
  return {
    departments: [{ id: 'dept-1', name: '数字科技管理事业部', isActive: true }],
    sections: [{ id: 'section-1', departmentId: 'dept-1', name: '数字业务中心', isActive: true }],
    users: [
      {
        id: 'user-1',
        employeeNo: null,
        name: '系统管理员',
        positionName: '系统管理员',
        departmentId: 'dept-1',
        sectionId: 'section-1',
        reviewGroupId: null,
        isActive: true
      },
      {
        id: 'user-2',
        employeeNo: null,
        name: '陈美果',
        positionName: '负责人',
        departmentId: 'dept-1',
        sectionId: 'section-1',
        reviewGroupId: null,
        isActive: true
      }
    ],
    localAccounts: [
      {
        userId: 'user-1',
        loginName: 'sysadmin.local',
        localLoginEnabled: true,
        password: ''
      },
      {
        userId: 'user-1',
        loginName: '',
        localLoginEnabled: true,
        password: ''
      }
    ],
    roleAssignments: [],
    sectionLeaderBindings: [],
    groupLeaderBindings: [],
    reviewGroups: [],
    goalTemplates: []
  };
}

describe('AccessSections local account editing', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
  });

  it('updates only the edited local account row even when duplicate user ids temporarily exist', () => {
    render(<AccessSectionsHarness initialDraft={createDraft()} />);

    const loginInputs = screen.getAllByPlaceholderText('请输入登录名');
    expect(loginInputs).toHaveLength(2);

    fireEvent.change(loginInputs[1], { target: { value: 'chen.meiguo' } });

    expect(loginInputs[0]).toHaveValue('sysadmin.local');
    expect(loginInputs[1]).toHaveValue('chen.meiguo');
  });

  it('removes only the clicked local account row instead of deleting all rows with the same user id', () => {
    render(<AccessSectionsHarness initialDraft={createDraft()} />);

    const removeButtons = screen.getAllByRole('button', { name: /删除/ });
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[1]);

    const loginInputs = screen.getAllByPlaceholderText('请输入登录名');
    expect(loginInputs).toHaveLength(1);
    expect(loginInputs[0]).toHaveValue('sysadmin.local');

    const rows = screen.getAllByRole('row');
    expect(rows.some((row) => within(row).queryByDisplayValue('sysadmin.local'))).toBe(true);
  });

  it('keeps a newly added local account row visible before the user is selected', () => {
    render(<AccessSectionsHarness initialDraft={createDraft()} />);

    fireEvent.click(screen.getByRole('button', { name: /新增本地账号/ }));

    const loginInputs = screen.getAllByRole('textbox');
    expect(loginInputs).toHaveLength(3);
    expect(loginInputs[2]).toHaveValue('');
  });
});
