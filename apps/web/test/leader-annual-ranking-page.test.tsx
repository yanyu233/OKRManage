import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaderAnnualRankingPage } from '../src/modules/leader/LeaderAnnualRankingPage';

const TEXT = {
  title: '年度排名列表',
  sectionFilter: '按科室筛选',
  groupFilter: '按小组筛选'
} as const;

function ensureMatchMedia() {
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
}

vi.mock('../src/shared/api/leader', () => ({
  getLeaderAnnualRanking: vi.fn(async () => ({
    year: 2026,
    ranking: [
      {
        employeeId: 'u-1',
        employeeName: '王敏',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        annualScore: 156.7,
        quarterScores: [
          { quarter: 1, score: 90.7 },
          { quarter: 2, score: 66 },
          { quarter: 3, score: 0 },
          { quarter: 4, score: 0 }
        ]
      },
      {
        employeeId: 'u-2',
        employeeName: '李雷',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-2',
        reviewGroupName: '运营组',
        annualScore: 120,
        quarterScores: [
          { quarter: 1, score: 30 },
          { quarter: 2, score: 30 },
          { quarter: 3, score: 30 },
          { quarter: 4, score: 30 }
        ]
      },
      {
        employeeId: 'u-3',
        employeeName: '张华',
        sectionId: 'sec-2',
        sectionName: '解决方案科',
        reviewGroupId: 'rg-3',
        reviewGroupName: '新员工组',
        annualScore: 88,
        quarterScores: [
          { quarter: 1, score: 22 },
          { quarter: 2, score: 22 },
          { quarter: 3, score: 22 },
          { quarter: 4, score: 22 }
        ]
      }
    ],
    selectedEmployee: null
  })),
  downloadLeaderAnnualRankingPublicNotice: vi.fn()
}));

describe('LeaderAnnualRankingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters annual ranking by section and review group', async () => {
    ensureMatchMedia();

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AntApp>
          <LeaderAnnualRankingPage />
        </AntApp>
      </QueryClientProvider>
    );

    await screen.findByText('王敏');
    const rankingCard = (await screen.findByText(TEXT.title)).closest('.leader-side-card');
    expect(rankingCard).toBeTruthy();
    expect(within(rankingCard as HTMLElement).getByText(/王敏/)).toBeTruthy();
    expect(within(rankingCard as HTMLElement).getByText(/李雷/)).toBeTruthy();
    expect(within(rankingCard as HTMLElement).getByText(/张华/)).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: TEXT.sectionFilter }));
    fireEvent.click(await screen.findByText('平台产品科'));

    const sectionFilteredCard = (await screen.findByText(TEXT.title)).closest('.leader-side-card');
    expect(within(sectionFilteredCard as HTMLElement).getByText(/王敏/)).toBeTruthy();
    expect(within(sectionFilteredCard as HTMLElement).getByText(/李雷/)).toBeTruthy();
    expect(within(sectionFilteredCard as HTMLElement).queryByText(/张华/)).toBeNull();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: TEXT.groupFilter }));
    fireEvent.click(await screen.findByText('运营组'));

    const groupFilteredCard = (await screen.findByText(TEXT.title)).closest('.leader-side-card');
    expect(within(groupFilteredCard as HTMLElement).getByText(/李雷/)).toBeTruthy();
    expect(within(groupFilteredCard as HTMLElement).queryByText(/王敏/)).toBeNull();
    expect(within(groupFilteredCard as HTMLElement).queryByText(/张华/)).toBeNull();
  });
});
