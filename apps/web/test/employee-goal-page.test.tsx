import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeGoalPage } from '../src/modules/employee/EmployeeGoalPage';

const mockNavigate = vi.fn();
const mockGetEmployeeGoalDetail = vi.fn();
const mockUpdateEmployeeGoal = vi.fn();
const mockSubmitEmployeeGoalReview = vi.fn();

vi.mock('../src/shared/api/employee', () => ({
  getEmployeeGoalDetail: (...args: unknown[]) => mockGetEmployeeGoalDetail(...args),
  updateEmployeeGoal: (...args: unknown[]) => mockUpdateEmployeeGoal(...args),
  submitEmployeeGoalReview: (...args: unknown[]) => mockSubmitEmployeeGoalReview(...args),
  updateEmployeeKrCompletion: vi.fn(),
  uploadEmployeeProof: vi.fn()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ goalId: 'goal-1' })
  };
  it('prefers proof preview and keeps download as a separate action', async () => {
    mockGetEmployeeGoalDetail.mockResolvedValueOnce({
      id: 'goal-1',
      code: 'O2',
      name: 'proof flow goal',
      description: 'proof flow goal desc',
      status: 'confirmed',
      totalPoints: 10,
      keyResultCount: 1,
      completedKeyResultCount: 1,
      proofCount: 1,
      currentScore: null,
      year: 2026,
      quarter: 1,
      keyResults: [
        {
          id: 'kr-1',
          code: 'KR1',
          name: 'proof flow kr',
          description: null,
          points: 10,
          scoreType: 'objective',
          completionState: 'completed',
          reviewScore: null,
          reviewComment: null,
          proofCount: 1,
          proofs: [
            {
              id: 'proof-1',
              fileName: 'quarter-proof.txt',
              previewUrl: 'http://127.0.0.1:3000/preview/onlinePreview?url=preview-token',
              downloadUrl: '/employee/proofs/proof-1/download',
              fileUrl: '/employee/proofs/proof-1/download',
              fileSize: 256,
              note: 'note',
              uploadedAt: '2026-04-13T08:00:00.000Z'
            }
          ]
        }
      ]
    });

    renderWithProviders(<EmployeeGoalPage />);

    const previewLink = await screen.findByRole('link', { name: 'quarter-proof.txt' });
    const previewAction = screen.getByRole('link', { name: '\u9884\u89c8' });
    const downloadAction = screen.getByRole('link', { name: '\u4e0b\u8f7d' });

    expect(previewLink).toHaveAttribute('href', 'http://127.0.0.1:3000/preview/onlinePreview?url=preview-token');
    expect(previewAction).toHaveAttribute('href', 'http://127.0.0.1:3000/preview/onlinePreview?url=preview-token');
    expect(downloadAction).toHaveAttribute('href', 'http://127.0.0.1:3000/api/employee/proofs/proof-1/download');
    expect(within(previewAction.closest('.employee-proof-actions') as HTMLElement).getAllByRole('link')).toHaveLength(2);
  });
});

describe('EmployeeGoalPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetEmployeeGoalDetail.mockReset();
    mockUpdateEmployeeGoal.mockReset();
    mockSubmitEmployeeGoalReview.mockReset();
    mockGetEmployeeGoalDetail.mockResolvedValue({
      id: 'goal-1',
      code: 'O3',
      name: '完成AI项目',
      description: 'AI项目',
      status: 'draft',
      totalPoints: 20,
      keyResultCount: 1,
      completedKeyResultCount: 0,
      proofCount: 0,
      currentScore: null,
      year: 2026,
      quarter: 1,
      keyResults: [
        {
          id: 'kr-1',
          code: 'KR1',
          name: 'AI项目可研上会',
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

  it('hides draft status text and exposes draft editing entry', async () => {
    renderWithProviders(<EmployeeGoalPage />);

    expect(await screen.findByRole('button', { name: '编辑目标' })).toBeInTheDocument();
    expect(screen.queryByText('草稿')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('选填，上传时会一并记录')).toBeInTheDocument();
    expect(screen.getByText('当前还没有上传证明材料')).toBeInTheDocument();
  });

  it('shows submit-for-review action for confirmed goals after all key results are completed', async () => {
    mockGetEmployeeGoalDetail.mockResolvedValueOnce({
      id: 'goal-1',
      code: 'O1',
      name: '季度交付质量目标',
      description: '补充评分前的确认链路',
      status: 'confirmed',
      totalPoints: 30,
      keyResultCount: 2,
      completedKeyResultCount: 2,
      proofCount: 1,
      currentScore: null,
      year: 2026,
      quarter: 1,
      keyResults: [
        {
          id: 'kr-1',
          code: 'KR1',
          name: '版本按时交付',
          description: null,
          points: 15,
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
          name: '缺陷响应及时',
          description: null,
          points: 15,
          scoreType: 'objective',
          completionState: 'completed',
          reviewScore: null,
          reviewComment: null,
          proofCount: 0,
          proofs: []
        }
      ]
    });

    renderWithProviders(<EmployeeGoalPage />);

    expect(await screen.findByRole('button', { name: '确认目标完成并提交评分' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '编辑目标' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '上传证明材料' }).length).toBeGreaterThan(0);
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
