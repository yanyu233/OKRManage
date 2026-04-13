import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeOkrPage } from '../src/modules/employee/EmployeeOkrPage';

const mockNavigate = vi.fn();
const mockGetEmployeeOkr = vi.fn();
const mockCreateEmployeeGoal = vi.fn();
const mockGetEmployeeGoalTemplates = vi.fn();
const mockImportEmployeeGoalTemplates = vi.fn();
const mockGetEmployeeGoalDetail = vi.fn();
const mockUpdateEmployeeGoal = vi.fn();

const EDIT_TEXT = '\u7f16\u8f91\u76ee\u6807';

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
  updateEmployeeGoal: (...args: unknown[]) => mockUpdateEmployeeGoal(...args)
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

    mockGetEmployeeOkr.mockResolvedValue({
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
          proofCount: 0,
          currentScore: null
        }
      ]
    });

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

  it('shows editable and read-only goal card buttons with distinct states', async () => {
    renderWithProviders(<EmployeeOkrPage />);

    const draftCard = (await screen.findByText('O1 Draft goal')).closest('.employee-goal-card');
    const lockedCard = screen.getByText('O2 Locked goal').closest('.employee-goal-card');

    expect(draftCard).not.toBeNull();
    expect(lockedCard).not.toBeNull();

    const editableButton = within(draftCard as HTMLElement).getByRole('button', { name: EDIT_TEXT });
    const readonlyButton = within(lockedCard as HTMLElement).getByRole('button', { name: EDIT_TEXT });

    expect(editableButton).toBeEnabled();
    expect(editableButton).toHaveClass('employee-goal-card__edit-button--editable');
    expect(readonlyButton).toBeDisabled();
    expect(readonlyButton).toHaveClass('employee-goal-card__edit-button--readonly');
  });

  it('opens the edit dialog from the goal card button without triggering card navigation', async () => {
    renderWithProviders(<EmployeeOkrPage />);

    const draftCard = (await screen.findByText('O1 Draft goal')).closest('.employee-goal-card');

    expect(draftCard).not.toBeNull();

    const editButton = within(draftCard as HTMLElement).getByRole('button', { name: EDIT_TEXT });
    fireEvent.click(editButton);

    expect(mockGetEmployeeGoalDetail).toHaveBeenCalledWith('goal-draft');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Draft goal')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

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
