import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LeaderWorkbenchPage } from '../src/modules/leader/LeaderWorkbenchPage';

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
  getLeaderWorkbench: async () => ({
    year: 2026,
    quarter: 1,
    employees: [
      {
        id: 'u-1',
        name: '张晨',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        canScore: true,
        goalCount: 2,
        keyResultCount: 6,
        scoredKeyResultCount: 3,
        proofCount: 2,
        quarterScore: 63.6,
        status: 'in-progress'
      },
      {
        id: 'u-2',
        name: '李雷',
        sectionId: 'sec-2',
        sectionName: '解决方案科',
        reviewGroupId: 'rg-2',
        reviewGroupName: '运营组',
        canScore: false,
        goalCount: 1,
        keyResultCount: 3,
        scoredKeyResultCount: 0,
        proofCount: 0,
        quarterScore: null,
        status: 'pending'
      }
    ],
    selectedEmployee: {
      id: 'u-1',
      name: '张晨',
      sectionId: 'sec-1',
      sectionName: '平台产品科',
      reviewGroupId: 'rg-1',
      reviewGroupName: '信息化组',
      canScore: true,
      goalCount: 2,
      keyResultCount: 6,
      scoredKeyResultCount: 3,
      proofCount: 2,
      quarterScore: 63.6,
      status: 'in-progress'
    },
    goals: [
      {
        id: 'g-1',
        code: 'O1',
        name: '平台模板目标',
        description: null,
        status: 'confirmed',
        totalPoints: 50,
        canScore: true,
        isTemplateGoal: true,
        keyResultCount: 2,
        scoredKeyResultCount: 0,
        proofCount: 0,
        currentScore: null
      },
      {
        id: 'g-2',
        code: 'O2',
        name: '张晨 2026 年一季度 OKR',
        description: null,
        status: 'confirmed',
        totalPoints: 80,
        canScore: true,
        isTemplateGoal: false,
        keyResultCount: 3,
        scoredKeyResultCount: 3,
        proofCount: 2,
        currentScore: 63.6
      }
    ],
    selectedGoal: {
      id: 'g-2',
      code: 'O2',
      name: '张晨 2026 年一季度 OKR',
      description: null,
      status: 'confirmed',
      totalPoints: 80,
      canScore: true,
      isTemplateGoal: false,
      keyResultCount: 3,
      scoredKeyResultCount: 3,
      proofCount: 2,
      currentScore: 63.6,
      keyResults: [
        {
          id: 'kr-1',
          code: 'KR1',
          name: '完成 6 个版本交付',
          description: null,
          points: 35,
          scoreType: 'objective',
          canScore: true,
          completionState: 'completed',
          reviewScore: 92.5,
          reviewComment: '表现稳定',
          proofCount: 2,
          proofs: []
        },
        {
          id: 'kr-2',
          code: 'KR2',
          name: '主观评估项',
          description: null,
          points: 20,
          scoreType: 'subjective',
          canScore: true,
          completionState: 'incomplete',
          reviewScore: null,
          reviewComment: null,
          proofCount: 0,
          proofs: []
        }
      ]
    }
  }),
  updateLeaderKrScore: vi.fn(),
  bulkLeaderKrScore: vi.fn()
}));

describe('LeaderWorkbenchPage batch score modal', () => {
  it('opens the objective bulk score modal with scoped filters and shortcuts', async () => {
    ensureMatchMedia();

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AntApp>
          <LeaderWorkbenchPage />
        </AntApp>
      </QueryClientProvider>
    );

    fireEvent.click(await screen.findByRole('button', { name: '客观项批量评分' }));

    expect(await screen.findByRole('dialog', { name: '客观项批量评分' })).toBeTruthy();
    expect(screen.getByText('按科室筛选')).toBeTruthy();
    expect(screen.getByText('按小组筛选')).toBeTruthy();
    expect(screen.getByRole('button', { name: '全选员工' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '全选目标' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '全选客观项关键结果' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '全选（去除模板目标）' })).toBeTruthy();
    expect(screen.getByText('批量评分仅处理客观评分项，主观评分项会保留在工作台中逐条评分。')).toBeTruthy();
  });
});
