import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { act } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeOkrPage } from '../src/modules/employee/EmployeeOkrPage';
import { resetSharedQuarterSelection } from '../src/shared/store/quarter-store';

const mockNavigate = vi.fn();
const mockGetEmployeeOkr = vi.fn();
const mockCreateEmployeeGoal = vi.fn();
const mockGetEmployeeGoalTemplates = vi.fn();
const mockImportEmployeeGoalTemplates = vi.fn();
const mockGetEmployeeGoalDetail = vi.fn();
const mockUpdateEmployeeGoal = vi.fn();
const mockDeleteEmployeeGoal = vi.fn();
const mockDeleteEmployeeKeyResult = vi.fn();

const EDIT_TEXT = '编辑目标';

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

vi.mock('../src/shared/api/employee', () => ({
  getEmployeeOkr: (...args: unknown[]) => mockGetEmployeeOkr(...args),
  createEmployeeGoal: (...args: unknown[]) => mockCreateEmployeeGoal(...args),
  getEmployeeGoalTemplates: (...args: unknown[]) => mockGetEmployeeGoalTemplates(...args),
  importEmployeeGoalTemplates: (...args: unknown[]) => mockImportEmployeeGoalTemplates(...args),
  getEmployeeGoalDetail: (...args: unknown[]) => mockGetEmployeeGoalDetail(...args),
  updateEmployeeGoal: (...args: unknown[]) => mockUpdateEmployeeGoal(...args),
  deleteEmployeeGoal: (...args: unknown[]) => mockDeleteEmployeeGoal(...args),
  deleteEmployeeKeyResult: (...args: unknown[]) => mockDeleteEmployeeKeyResult(...args)
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('EmployeeOkrPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetEmployeeOkr.mockReset();
    mockCreateEmployeeGoal.mockReset();
    mockGetEmployeeGoalTemplates.mockReset();
    mockImportEmployeeGoalTemplates.mockReset();
    mockGetEmployeeGoalDetail.mockReset();
    mockUpdateEmployeeGoal.mockReset();
    mockDeleteEmployeeGoal.mockReset();
    mockDeleteEmployeeKeyResult.mockReset();
    resetSharedQuarterSelection(new Date('2026-02-15T09:00:00'));

    mockGetEmployeeOkr.mockResolvedValue(buildEmployeeOkrPayload());

    mockGetEmployeeGoalDetail.mockResolvedValue({
      id: 'goal-draft',
      code: 'O1',
      name: 'Draft goal',
      description: 'Draft description',
      status: 'draft',
      totalPoints: 20,
      keyResultCount: 2,
      completedKeyResultCount: 1,
      proofCount: 1,
      currentScore: null,
      year: 2026,
      quarter: 1,
      keyResults: [
        {
          id: 'kr-1',
          code: 'KR1',
          name: 'Ship feature',
          description: null,
          points: 10,
          scoreType: 'objective',
          completionState: 'completed',
          reviewScore: null,
          reviewComment: null,
          proofCount: 1,
          proofs: []
        },
        {
          id: 'kr-2',
          code: 'KR2',
          name: 'Verify rollout',
          description: null,
          points: 10,
          scoreType: 'objective',
          completionState: 'incomplete',
          reviewScore: null,
          reviewComment: null,
          proofCount: 0,
          proofs: []
        }
      ]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows editable and read-only goal card buttons with distinct states', async () => {
    renderWithProviders(<EmployeeOkrPage />);

    const draftCard = (await screen.findByText('O1 Draft goal')).closest('.employee-goal-accordion');
    const lockedCard = screen.getByText('O2 Locked goal').closest('.employee-goal-accordion');

    expect(draftCard).not.toBeNull();
    expect(lockedCard).not.toBeNull();

    const editableButton = within(draftCard as HTMLElement).getByRole('button', { name: /\u7f16\u8f91\u76ee\u6807/ });
    const deleteButton = within(draftCard as HTMLElement).getByRole('button', { name: /删除目标/ });

    expect(editableButton).toBeEnabled();
    expect(deleteButton).toBeEnabled();
    expect(within(lockedCard as HTMLElement).queryByRole('button', { name: /\u7f16\u8f91\u76ee\u6807/ })).toBeNull();
    expect(within(lockedCard as HTMLElement).queryByRole('button', { name: /删除目标/ })).toBeNull();
  });

  it('opens the edit dialog from the goal card button without triggering card navigation', async () => {
    renderWithProviders(<EmployeeOkrPage />);

    const draftCard = (await screen.findByText('O1 Draft goal')).closest('.employee-goal-accordion');
    expect(draftCard).not.toBeNull();

    const editButton = within(draftCard as HTMLElement).getByRole('button', { name: /\u7f16\u8f91\u76ee\u6807/ });
    fireEvent.click(editButton);

    expect(mockGetEmployeeGoalDetail).toHaveBeenCalledWith('goal-draft');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Draft goal')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it(
    'defaults to the business quarter and switches immediately when a quarter is clicked',
    async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-14T09:00:00'));
      resetSharedQuarterSelection(new Date('2026-04-14T09:00:00'));

      renderWithProviders(<EmployeeOkrPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(screen.getByText('O1 Draft goal')).toBeInTheDocument();
      const periodTrigger = screen.getByRole('button', { name: /2026年一季度/ });
      fireEvent.click(periodTrigger);

      expect(screen.getByText('选择时间')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2026年' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /2026年三季度/ }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(screen.queryByText('选择时间')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /2026年三季度/ })).toBeInTheDocument();
      expect(mockGetEmployeeOkr).toHaveBeenLastCalledWith({ year: 2026, quarter: 3 });
    },
    10000
  );

  it('keeps hook order stable when the page switches from loading to loaded', async () => {
    let resolveOkr: ((value: ReturnType<typeof buildEmployeeOkrPayload>) => void) | null = null;
    mockGetEmployeeOkr.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOkr = resolve;
        })
    );

    renderWithProviders(<EmployeeOkrPage />);

    await act(async () => {
      resolveOkr?.(buildEmployeeOkrPayload());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await screen.findByText('O1 Draft goal')).toBeInTheDocument();
    expect(screen.getByText('O2 Locked goal')).toBeInTheDocument();
  });
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await vi.runAllTimersAsync();
  });
}

function renderWithProviders(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <AntApp>
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </AntApp>
  );
}

function buildEmployeeOkrPayload() {
  return {
    year: 2026,
    quarter: 1,
    employee: {
      id: 'employee-1',
      name: 'Test Employee',
      sectionName: 'AI',
      reviewGroupName: 'Alpha',
      goalCount: 2,
      keyResultCount: 3,
      completedKeyResultCount: 1,
      missingProofKeyResultCount: 2,
      proofCount: 1,
      quarterScore: null
    },
    goals: [
      {
        id: 'goal-draft',
        code: 'O1',
        name: 'Draft goal',
        description: 'Draft description',
        status: 'draft',
        totalPoints: 20,
        keyResultCount: 2,
        completedKeyResultCount: 1,
        missingProofKeyResultCount: 1,
        proofCount: 1,
        currentScore: null
      },
      {
        id: 'goal-confirmed',
        code: 'O2',
        name: 'Locked goal',
        description: 'Locked description',
        status: 'confirmed',
        totalPoints: 10,
        keyResultCount: 1,
        completedKeyResultCount: 0,
        missingProofKeyResultCount: 1,
        proofCount: 0,
        currentScore: null
      }
    ]
  };
}
