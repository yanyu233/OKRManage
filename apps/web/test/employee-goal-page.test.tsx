import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeGoalPage } from '../src/modules/employee/EmployeeGoalPage';
import { ApiError } from '../src/shared/api/http';

const mockNavigate = vi.fn();
const mockGetEmployeeGoalDetail = vi.fn();
const mockUpdateEmployeeGoal = vi.fn();
const mockDeleteEmployeeGoal = vi.fn();
const mockDeleteEmployeeKeyResult = vi.fn();

vi.mock('../src/shared/api/employee', () => ({
  getEmployeeGoalDetail: (...args: unknown[]) => mockGetEmployeeGoalDetail(...args),
  updateEmployeeGoal: (...args: unknown[]) => mockUpdateEmployeeGoal(...args),
  deleteEmployeeGoal: (...args: unknown[]) => mockDeleteEmployeeGoal(...args),
  deleteEmployeeKeyResult: (...args: unknown[]) => mockDeleteEmployeeKeyResult(...args),
  uploadEmployeeProof: vi.fn()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ goalId: 'goal-1' })
  };
});

describe('EmployeeGoalPage proof actions', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetEmployeeGoalDetail.mockReset();
    mockUpdateEmployeeGoal.mockReset();
    mockDeleteEmployeeGoal.mockReset();
    mockDeleteEmployeeKeyResult.mockReset();
  });

  it('opens the final preview target directly and keeps download as a separate action', async () => {
    mockGetEmployeeGoalDetail.mockResolvedValueOnce({
      id: 'goal-1',
      code: 'O2',
      name: 'proof flow goal',
      description: 'proof flow goal desc',
      status: 'confirmed',
      totalPoints: 10,
      keyResultCount: 1,
      completedKeyResultCount: 1,
      missingProofKeyResultCount: 0,
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
          hasProofs: true,
          isProofMissing: false,
          proofCount: 1,
          latestProofUploadedAt: '2026-04-13T08:00:00.000Z',
          proofs: [
            {
              id: 'proof-1',
              fileName: 'quarter-proof.txt',
              previewUrl: 'http://127.0.0.1:8012/onlinePreview?url=preview-token',
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
    fireEvent.click(await screen.findByRole('button', { name: /KR1 proof flow kr/i }));

    const previewLink = await screen.findByRole('link', { name: 'quarter-proof.txt' });
    const previewAction = screen.getByRole('link', { name: '预览' });
    const downloadAction = screen.getByRole('link', { name: '下载' });

    expect(previewLink).toHaveAttribute('href', 'http://127.0.0.1:8012/onlinePreview?url=preview-token');
    expect(previewAction).toHaveAttribute('href', 'http://127.0.0.1:8012/onlinePreview?url=preview-token');
    expect(downloadAction).toHaveAttribute('href', 'http://127.0.0.1:3000/api/employee/proofs/proof-1/download');
    expect(within(previewAction.closest('.employee-proof-actions') as HTMLElement).getAllByRole('link')).toHaveLength(2);
  });
});

describe('EmployeeGoalPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetEmployeeGoalDetail.mockReset();
    mockUpdateEmployeeGoal.mockReset();
    mockDeleteEmployeeGoal.mockReset();
    mockDeleteEmployeeKeyResult.mockReset();
    mockGetEmployeeGoalDetail.mockResolvedValue({
      id: 'goal-1',
      code: 'O3',
      name: '完成 AI 项目',
      description: 'AI 项目',
      status: 'draft',
      totalPoints: 20,
      keyResultCount: 2,
      completedKeyResultCount: 0,
      missingProofKeyResultCount: 2,
      proofCount: 0,
      currentScore: null,
      year: 2026,
      quarter: 1,
      keyResults: [
        {
          id: 'kr-1',
          code: 'KR1',
          name: 'AI 项目可研上会',
          description: null,
          points: 10,
          scoreType: 'objective',
          completionState: 'incomplete',
          reviewScore: null,
          reviewComment: null,
          hasProofs: false,
          isProofMissing: true,
          proofCount: 0,
          latestProofUploadedAt: null,
          proofs: []
        },
        {
          id: 'kr-2',
          code: 'KR2',
          name: 'AI review output',
          description: null,
          points: 10,
          scoreType: 'objective',
          completionState: 'incomplete',
          reviewScore: null,
          reviewComment: null,
          hasProofs: false,
          isProofMissing: true,
          proofCount: 0,
          latestProofUploadedAt: null,
          proofs: []
        }
      ]
    });
  });

  it('hides draft status text and keeps proof upload as the only completion path', async () => {
    renderWithProviders(<EmployeeGoalPage />);

    expect(await screen.findByRole('button', { name: '编辑目标' })).toBeInTheDocument();
    expect(screen.queryByText('草稿')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /KR1 AI 项目可研上会/i }));
    expect(screen.getByPlaceholderText('可选填写，本次上传的文件会统一使用这段说明')).toBeInTheDocument();
    expect(screen.getByText('当前还没有上传证明材料')).toBeInTheDocument();
    expect(screen.queryByText('完成状态')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '改回未完成' })).not.toBeInTheDocument();
  });

  it('opens the upload area directly from the summary upload button', async () => {
    renderWithProviders(<EmployeeGoalPage />);

    const uploadButtons = await screen.findAllByRole('button', { name: /上传材料/ });
    fireEvent.click(uploadButtons[0]);

    expect(await screen.findByPlaceholderText('可选填写，本次上传的文件会统一使用这段说明')).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="file"]').length).toBeGreaterThan(0);
  });

  it('keeps confirmed goals in material maintenance mode without manual completion editing', async () => {
    mockGetEmployeeGoalDetail.mockResolvedValueOnce({
      id: 'goal-1',
      code: 'O1',
      name: '季度交付质量目标',
      description: '补充评分前的确认链路',
      status: 'confirmed',
      totalPoints: 30,
      keyResultCount: 2,
      completedKeyResultCount: 2,
      missingProofKeyResultCount: 1,
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
          hasProofs: true,
          isProofMissing: false,
          proofCount: 1,
          latestProofUploadedAt: '2026-04-13T08:00:00.000Z',
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
          hasProofs: false,
          isProofMissing: true,
          proofCount: 0,
          latestProofUploadedAt: null,
          proofs: []
        }
      ]
    });

    renderWithProviders(<EmployeeGoalPage />);

    expect(await screen.findByText('目标已确认，当前以补充材料为主。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '确认目标完成并提交评分' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '编辑目标' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /上传材料/ }).length).toBeGreaterThan(0);
  });

  it('shows draft delete actions for the goal and key results', async () => {
    renderWithProviders(<EmployeeGoalPage />);

    expect(await screen.findByRole('button', { name: /删除目标/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /KR1 AI 项目可研上会/i }));
    expect(screen.getAllByRole('button', { name: /删除KR/ }).length).toBeGreaterThan(0);
  });

  it('redirects to the employee OKR list when the goal no longer exists', async () => {
    mockGetEmployeeGoalDetail.mockRejectedValueOnce(new ApiError('goal not found', 404));

    renderWithProviders(<EmployeeGoalPage />);

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/employee/okr', { replace: true });
    });
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
