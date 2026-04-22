import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaderRankingPage } from '../src/modules/leader/LeaderRankingPage';
import { resetSharedQuarterSelection } from '../src/shared/store/quarter-store';

const mockGetLeaderRanking = vi.fn();

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

vi.mock('../src/shared/api/leader', () => ({
  getLeaderRanking: (...args: unknown[]) => mockGetLeaderRanking(...args),
  downloadLeaderRankingPublicNotice: vi.fn(),
  saveLeaderRankingTieBreak: vi.fn()
}));

describe('LeaderRankingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedQuarterSelection(new Date('2026-04-21T09:00:00'));

    mockGetLeaderRanking.mockResolvedValue({
      year: 2026,
      quarter: 1,
      scoresVisible: true,
      canManageTieBreaks: false,
      reviewGroups: [{ id: 'rg-1', name: '信息化组' }],
      selectedReviewGroup: { id: 'rg-1', name: '信息化组' },
      seatSummary: [
        { gradeCode: 'A+', seatCount: 1, occupiedCount: 1 },
        { gradeCode: 'A', seatCount: 2, occupiedCount: 2 }
      ],
      ranking: [
        {
          employeeId: 'emp-1',
          employeeName: '方墨',
          sectionName: '工业互联网中心',
          reviewGroupName: '信息化组',
          quarterScore: 91,
          goalCount: 3,
          keyResultCount: 9,
          scoredKeyResultCount: 9,
          currentGrade: 'A+',
          tieBreakStatus: 'resolved',
          status: 'completed'
        }
      ],
      selectedEmployee: {
        employeeId: 'emp-1',
        employeeName: '方墨',
        sectionName: '工业互联网中心',
        reviewGroupName: '信息化组',
        quarterScore: 91,
        currentGrade: 'A+',
        tieBreakStatus: 'resolved',
        goalBreakdown: [
          {
            goalId: 'goal-1',
            goalCode: 'O1',
            goalName: '工作态度与能力',
            goalScore: 27,
            keyResultCount: 5,
            scoredKeyResultCount: 5,
            keyResults: [
              {
                keyResultId: 'kr-1',
                code: 'KR1',
                name: '活动与会议、5S管理出勤',
                points: 5,
                reviewScore: 5
              }
            ]
          }
        ]
      },
      pendingTieGroups: []
    });
  });

  it('does not trigger maximum update depth warnings while loading and rendering', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AntApp>
          <LeaderRankingPage />
        </AntApp>
      </QueryClientProvider>
    );

    await screen.findByText('评分排名');
    await waitFor(() => expect(screen.getByText('方墨')).toBeInTheDocument());

    const errorOutput = consoleError.mock.calls
      .flat()
      .map((entry) => String(entry))
      .join(' ');

    expect(errorOutput).not.toContain('Maximum update depth exceeded');
    consoleError.mockRestore();
  });
});
