import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LeaderWorkbenchPage } from '../src/modules/leader/LeaderWorkbenchPage';

const T = {
  batchTitle: '\u5ba2\u89c2\u9879\u6279\u91cf\u8bc4\u5206',
  sectionFilter: '\u6309\u79d1\u5ba4\u7b5b\u9009',
  groupFilter: '\u6309\u5c0f\u7ec4\u7b5b\u9009',
  selectAllKrs: '\u5168\u9009\u5ba2\u89c2\u9879\u5173\u952e\u7ed3\u679c',
  cancel: '\u53d6\u6d88',
  selectedEmployees: '\u5df2\u9009\u5458\u5de5',
  selectedGoals: '\u5df2\u9009\u76ee\u6807',
  selectedKrs: '\u5df2\u9009\u5173\u952e\u7ed3\u679c',
  batchSave: '\u6279\u91cf\u8d4b\u6ee1\u5206',
  employeeName: '\u5f20\u6668',
  readonlyEmployee: '\u674e\u96f7',
  employeeGoal1: '\u5f20\u6668 / O1 \u5e73\u53f0\u6a21\u677f\u76ee\u6807',
  employeeGoal2: '\u5f20\u6668 / O2 \u5f20\u6668 2026 \u5e74\u4e00\u5b63\u5ea6 OKR',
  readonlyGoal: '\u674e\u96f7 / O3 \u674e\u96f7 \u8fd0\u8425\u652f\u6491\u4e13\u9879',
  templateKr: 'KR1 \u6a21\u677f\u5ba2\u89c2\u9879',
  deliveryKr: 'KR1 \u5b8c\u6210 6 \u4e2a\u7248\u672c\u4ea4\u4ed8'
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
  getLeaderWorkbench: async () => ({
    year: 2026,
    quarter: 1,
    employees: [
      {
        id: 'u-1',
        name: T.employeeName,
        sectionId: 'sec-1',
        sectionName: '\u5e73\u53f0\u4ea7\u54c1\u79d1',
        reviewGroupId: 'rg-1',
        reviewGroupName: '\u4fe1\u606f\u5316\u7ec4',
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
        name: T.readonlyEmployee,
        sectionId: 'sec-2',
        sectionName: '\u89e3\u51b3\u65b9\u6848\u79d1',
        reviewGroupId: 'rg-2',
        reviewGroupName: '\u8fd0\u8425\u7ec4',
        canScore: false,
        goalCount: 1,
        keyResultCount: 2,
        scoredKeyResultCount: 0,
        proofCount: 0,
        quarterScore: null,
        status: 'pending'
      }
    ],
    selectedEmployee: {
      id: 'u-1',
      name: T.employeeName,
      sectionId: 'sec-1',
      sectionName: '\u5e73\u53f0\u4ea7\u54c1\u79d1',
      reviewGroupId: 'rg-1',
      reviewGroupName: '\u4fe1\u606f\u5316\u7ec4',
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
        name: '\u5e73\u53f0\u6a21\u677f\u76ee\u6807',
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
        name: '\u5f20\u6668 2026 \u5e74\u4e00\u5b63\u5ea6 OKR',
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
      name: '\u5f20\u6668 2026 \u5e74\u4e00\u5b63\u5ea6 OKR',
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
          name: '\u5b8c\u6210 6 \u4e2a\u7248\u672c\u4ea4\u4ed8',
          description: null,
          points: 35,
          scoreType: 'objective',
          canScore: true,
          completionState: 'completed',
          reviewScore: 30.1,
          reviewComment: '\u8868\u73b0\u7a33\u5b9a',
          proofCount: 2,
          proofs: []
        },
        {
          id: 'kr-2',
          code: 'KR2',
          name: '\u4e3b\u89c2\u8bc4\u4f30\u9879',
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
    },
    bulkCatalog: [
      {
        id: 'u-1',
        name: T.employeeName,
        sectionId: 'sec-1',
        sectionName: '\u5e73\u53f0\u4ea7\u54c1\u79d1',
        reviewGroupId: 'rg-1',
        reviewGroupName: '\u4fe1\u606f\u5316\u7ec4',
        canScore: true,
        goals: [
          {
            id: 'g-1',
            code: 'O1',
            name: '\u5e73\u53f0\u6a21\u677f\u76ee\u6807',
            isTemplateGoal: true,
            keyResults: [
              {
                id: 'g1-kr1',
                code: 'KR1',
                name: '\u6a21\u677f\u5ba2\u89c2\u9879',
                points: 20,
                scoreType: 'objective',
                reviewScore: null
              }
            ]
          },
          {
            id: 'g-2',
            code: 'O2',
            name: '\u5f20\u6668 2026 \u5e74\u4e00\u5b63\u5ea6 OKR',
            isTemplateGoal: false,
            keyResults: [
              {
                id: 'kr-1',
                code: 'KR1',
                name: '\u5b8c\u6210 6 \u4e2a\u7248\u672c\u4ea4\u4ed8',
                points: 35,
                scoreType: 'objective',
                reviewScore: 30.1
              },
              {
                id: 'kr-2',
                code: 'KR2',
                name: '\u4e3b\u89c2\u8bc4\u4f30\u9879',
                points: 20,
                scoreType: 'subjective',
                reviewScore: null
              }
            ]
          }
        ]
      },
      {
        id: 'u-2',
        name: T.readonlyEmployee,
        sectionId: 'sec-2',
        sectionName: '\u89e3\u51b3\u65b9\u6848\u79d1',
        reviewGroupId: 'rg-2',
        reviewGroupName: '\u8fd0\u8425\u7ec4',
        canScore: false,
        goals: [
          {
            id: 'g-3',
            code: 'O3',
            name: '\u674e\u96f7 \u8fd0\u8425\u652f\u6491\u4e13\u9879',
            isTemplateGoal: false,
            keyResults: [
              {
                id: 'g3-kr1',
                code: 'KR1',
                name: '\u8fd0\u8425\u8d44\u6599\u8865\u9f50',
                points: 20,
                scoreType: 'objective',
                reviewScore: null
              }
            ]
          }
        ]
      }
    ]
  }),
  updateLeaderKrScore: vi.fn(),
  bulkLeaderKrScore: vi.fn()
}));

describe('LeaderWorkbenchPage batch score modal', () => {
  it(
    'shows selected employees, goals and objective key results for full-score bulk actions',
    async () => {
      ensureMatchMedia();

      render(
        <QueryClientProvider client={new QueryClient()}>
          <AntApp>
            <LeaderWorkbenchPage />
          </AntApp>
        </QueryClientProvider>
      );

      fireEvent.click(await screen.findByRole('button', { name: T.batchTitle }));

      expect(await screen.findByRole('dialog', { name: T.batchTitle })).toBeTruthy();
      expect(screen.getByText(T.sectionFilter)).toBeTruthy();
      expect(screen.getByText(T.groupFilter)).toBeTruthy();
      expect(screen.getByRole('button', { name: T.selectAllKrs })).toBeTruthy();
      expect(screen.queryByRole('button', { name: '\u5168\u9009\u5458\u5de5' })).toBeNull();
      expect(screen.queryByRole('button', { name: '\u5168\u9009\u76ee\u6807' })).toBeNull();
      expect(screen.queryByRole('button', { name: '\u5168\u9009\uff08\u53bb\u9664\u6a21\u677f\u76ee\u6807\uff09' })).toBeNull();
      expect(screen.getByRole('button', { name: /取\s*消/ })).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: T.selectAllKrs }));

      expect(await screen.findByText(T.selectedEmployees)).toBeTruthy();
      expect(screen.getAllByText(T.employeeName).length).toBeGreaterThan(0);
      expect(screen.queryByText(`${T.readonlyEmployee}\uff08\u53ea\u8bfb\uff09`)).toBeNull();
      expect(screen.getByText(T.selectedGoals)).toBeTruthy();
      expect(screen.getAllByText(T.employeeGoal1).length).toBeGreaterThan(0);
      expect(screen.getAllByText(T.employeeGoal2).length).toBeGreaterThan(0);
      expect(screen.queryByText(T.readonlyGoal)).toBeNull();
      expect(screen.getByText(T.selectedKrs)).toBeTruthy();
      expect(screen.getAllByText(T.templateKr).length).toBeGreaterThan(0);
      expect(screen.getAllByText(T.deliveryKr).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: T.batchSave })).toBeTruthy();
    },
    10000
  );
});
