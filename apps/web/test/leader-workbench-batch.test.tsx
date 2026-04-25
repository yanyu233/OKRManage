import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaderObjectiveWorkbenchPage as LeaderWorkbenchPage } from '../src/modules/leader/LeaderWorkbenchPage';
import { LeaderSubjectiveWorkbenchPage } from '../src/modules/leader/LeaderWorkbenchPage';
import { bulkLeaderKrScore } from '../src/shared/api/leader';

const T = {
  batchTitle: '\u5173\u952e\u7ed3\u679c\u6279\u91cf\u8bc4\u5206',
  sectionFilter: '\u6309\u79d1\u5ba4\u7b5b\u9009',
  groupFilter: '\u6309\u5c0f\u7ec4\u7b5b\u9009',
  all: '\u5168\u90e8',
  section1: '\u5e73\u53f0\u4ea7\u54c1\u79d1',
  section2: '\u89e3\u51b3\u65b9\u6848\u79d1',
  group1: '\u4fe1\u606f\u5316\u7ec4',
  group2: '\u8fd0\u8425\u7ec4',
  excludeTemplateGoals: '\u6392\u9664\u6a21\u677f\u76ee\u6807',
  excludeSpecificTemplateGoals: '\u6392\u9664\u6307\u5b9a\u6a21\u677f\u76ee\u6807',
  excludeTemplateKeyResults: '\u6392\u9664\u6a21\u677f\u5173\u952e\u7ed3\u679c',
  excludeTemplateKeyResultsPlaceholder: '\u9009\u62e9\u8981\u6392\u9664\u7684\u6a21\u677f\u5173\u952e\u7ed3\u679c',
  excludedTemplateGoalTag: '\u5df2\u6392\u9664\u6a21\u677f\u76ee\u6807',
  excludedTemplateGoalCountTag: '\u5df2\u6392\u9664\u6a21\u677f\u76ee\u6807 1 \u4e2a',
  excludedTemplateKrTag: '\u5df2\u6392\u9664\u6a21\u677f KR 1 \u9879',
  onlyTemplateGoal: '\u4ec5\u9009\u62e9\u6a21\u677f\u76ee\u6807',
  onlyTemplateGoalPlaceholder: '\u53ef\u591a\u9009\u6a21\u677f\u76ee\u6807',
  onlyTemplateKeyResults: '\u4ec5\u9009\u62e9\u6a21\u677f\u76ee\u6807\u7684\u5173\u952e\u7ed3\u679c',
  onlyTemplateGoalTag: '\u4ec5\u6a21\u677f\u76ee\u6807',
  onlyTemplateGoalCountTag: '\u5df2\u9650\u5b9a\u6a21\u677f\u76ee\u6807 1 \u4e2a',
  onlyTemplateGoalCountTagMulti: '\u5df2\u9650\u5b9a\u6a21\u677f\u76ee\u6807 2 \u4e2a',
  onlyTemplateKrTag: '\u6a21\u677f KR \u5df2\u9650\u5b9a 1 \u9879',
  onlyTemplateKrTagMulti: '\u6a21\u677f KR \u5df2\u9650\u5b9a 3 \u9879',
  selectAllKrs: '\u5168\u9009\u5ba2\u89c2\u9879\u5173\u952e\u7ed3\u679c',
  selectAllUnscoredKrs: '\u5168\u9009\u672a\u8bc4\u4ef7\u5173\u952e\u7ed3\u679c',
  cancel: '\u53d6\u6d88',
  selectedEmployees: '\u5df2\u9009\u5458\u5de5',
  selectedGoals: '\u5df2\u9009\u76ee\u6807',
  selectedKrs: '\u5df2\u9009\u5173\u952e\u7ed3\u679c',
  batchSave: '\u6279\u91cf\u8d4b\u5206',
  batchMissingProofTitle: '\u6709 1 \u6761\u5173\u952e\u7ed3\u679c\u672a\u63d0\u4ea4\u6750\u6599\uff0c\u9ed8\u8ba4\u4e0d\u4f1a\u53c2\u4e0e\u6279\u91cf\u8d4b\u5206',
  batchAllowMissingProofs: '\u5141\u8bb8\u5bf9\u672a\u63d0\u4ea4\u6750\u6599\u7684\u5173\u952e\u7ed3\u679c\u7ee7\u7eed\u6279\u91cf\u8d4b\u5206',
  batchModeCustom: '\u6309\u81ea\u5b9a\u4e49\u5206\u6570',
  batchCustomScoreLabel: '\u81ea\u5b9a\u4e49\u5206\u6570',
  subjectiveBatchTitle: '\u4e3b\u89c2\u9879\u6279\u91cf\u8bc4\u5206',
  subjectiveBatchSave: '\u6279\u91cf\u4fdd\u5b58\u4e3b\u89c2\u9879',
  subjectiveItem: '\u4e3b\u89c2\u8bc4\u4f30\u9879',
  batchCustomScoreExceeded:
    '\u81ea\u5b9a\u4e49\u5206\u6570 36 \u5206\u5df2\u8d85\u8fc7\u5f53\u524d\u5df2\u9009\u5173\u952e\u7ed3\u679c\u7684\u6700\u4f4e\u5206\u503c 20 \u5206\uff0c\u8bf7\u8c03\u6574\u540e\u518d\u6279\u91cf\u8d4b\u5206\u3002',
  removeTemplateKr: '\u79fb\u9664 KR1 \u6a21\u677f\u5ba2\u89c2\u9879',
  employeeName: '\u5f20\u6668',
  readonlyEmployee: '\u674e\u96f7',
  employeeGoal1: '\u5f20\u6668 / O1 \u5e73\u53f0\u6a21\u677f\u76ee\u6807',
  employeeGoal3: '\u5f20\u6668 / O3 \u534f\u540c\u6a21\u677f\u76ee\u6807',
  employeeGoal2: '\u5f20\u6668 / O2 \u5f20\u6668 2026 \u5e74\u4e00\u5b63\u5ea6 OKR',
  readonlyGoal: '\u674e\u96f7 / O3 \u674e\u96f7 \u8fd0\u8425\u652f\u6491\u4e13\u9879',
  templateGoalOption1: 'O1 \u5e73\u53f0\u6a21\u677f\u76ee\u6807',
  templateGoalOption2: 'O3 \u534f\u540c\u6a21\u677f\u76ee\u6807',
  templateKrOption1: 'O1 \u5e73\u53f0\u6a21\u677f\u76ee\u6807 / KR1 \u6a21\u677f\u5ba2\u89c2\u9879',
  templateKrOption2: 'O1 \u5e73\u53f0\u6a21\u677f\u76ee\u6807 / KR2 \u6a21\u677f\u8d28\u91cf\u8fbe\u6807',
  templateKrOption3: 'O3 \u534f\u540c\u6a21\u677f\u76ee\u6807 / KR1 \u6a21\u677f\u4ea4\u4ed8\u65f6\u6548',
  templateKr: 'KR1 \u6a21\u677f\u5ba2\u89c2\u9879',
  templateQualityKr: 'KR2 \u6a21\u677f\u8d28\u91cf\u8fbe\u6807',
  templateDeliveryKr: 'KR1 \u6a21\u677f\u4ea4\u4ed8\u65f6\u6548',
  deliveryKr: 'KR1 \u5b8c\u6210 6 \u4e2a\u7248\u672c\u4ea4\u4ed8',
  subjectiveKr: 'KR2 \u4e3b\u89c2\u8bc4\u4f30\u9879'
} as const;

function ensureMatchMedia() {
  const nativeGetComputedStyle = window.getComputedStyle.bind(window);
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
  Object.defineProperty(window, 'getComputedStyle', {
    writable: true,
    value: vi.fn().mockImplementation((element: Element) => nativeGetComputedStyle(element))
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    writable: true,
    value: vi.fn()
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
        missingProofKeyResultCount: 2,
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
        missingProofKeyResultCount: 2,
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
      missingProofKeyResultCount: 2,
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
        missingProofKeyResultCount: 1,
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
        missingProofKeyResultCount: 1,
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
      missingProofKeyResultCount: 1,
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
          hasProofs: true,
          isProofMissing: false,
          proofCount: 2,
          latestProofUploadedAt: '2026-03-20T10:00:00.000Z',
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
          hasProofs: false,
          isProofMissing: true,
          proofCount: 0,
          latestProofUploadedAt: null,
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
                reviewScore: null,
                proofCount: 0,
                hasProofs: false,
                isProofMissing: true
              },
              {
                id: 'g1-kr2',
                code: 'KR2',
                name: '\u6a21\u677f\u8d28\u91cf\u8fbe\u6807',
                points: 22,
                scoreType: 'objective',
                reviewScore: 18,
                proofCount: 1,
                hasProofs: true,
                isProofMissing: false
              }
            ]
          },
          {
            id: 'g-3',
            code: 'O3',
            name: '\u534f\u540c\u6a21\u677f\u76ee\u6807',
            isTemplateGoal: true,
            keyResults: [
              {
                id: 'g3-kr2',
                code: 'KR1',
                name: '\u6a21\u677f\u4ea4\u4ed8\u65f6\u6548',
                points: 24,
                scoreType: 'objective',
                reviewScore: 20,
                proofCount: 1,
                hasProofs: true,
                isProofMissing: false
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
                reviewScore: 30.1,
                proofCount: 2,
                hasProofs: true,
                isProofMissing: false
              },
              {
                id: 'kr-2',
                code: 'KR2',
                name: '\u4e3b\u89c2\u8bc4\u4f30\u9879',
                points: 20,
                scoreType: 'subjective',
                reviewScore: null,
                proofCount: 0,
                hasProofs: false,
                isProofMissing: true
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
                reviewScore: null,
                proofCount: 0,
                hasProofs: false,
                isProofMissing: true
              }
            ]
          }
        ]
      }
    ]
  }),
  updateLeaderKrScore: vi.fn(),
  bulkLeaderKrScore: vi.fn(),
  updateLeaderProofKnowledge: vi.fn()
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(bulkLeaderKrScore).mockResolvedValue({
    updatedCount: 1,
    skippedCount: 0,
    skipped: []
  });
});

describe('LeaderWorkbenchPage batch score modal', () => {
  it(
    'supports excluding template goals from objective bulk selection',
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
      fireEvent.click(screen.getByRole('checkbox', { name: T.excludeTemplateGoals }));
      fireEvent.click(await screen.findByRole('button', { name: T.selectAllKrs }));

      expect(await screen.findByText(T.excludedTemplateGoalTag)).toBeTruthy();

      const selectedGoalCard = screen.getByText(T.selectedGoals).closest('.ant-card');
      expect(selectedGoalCard).toBeTruthy();
      expect(within(selectedGoalCard as HTMLElement).queryByText(T.employeeGoal1)).toBeNull();
      expect(within(selectedGoalCard as HTMLElement).getAllByText(T.employeeGoal2).length).toBeGreaterThan(0);

      const selectedKrCard = screen.getByText(T.selectedKrs).closest('.ant-card');
      expect(selectedKrCard).toBeTruthy();
      expect(within(selectedKrCard as HTMLElement).queryByText(T.templateKr)).toBeNull();
      expect(within(selectedKrCard as HTMLElement).getAllByText(T.deliveryKr).length).toBeGreaterThan(0);
    },
    10000
  );

  it(
    'supports excluding a specific template key result from bulk selection',
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
      fireEvent.mouseDown(screen.getByRole('combobox', { name: T.excludeTemplateKeyResults }));
      fireEvent.click(await screen.findByText(T.templateKrOption1));
      fireEvent.click(await screen.findByRole('button', { name: T.selectAllKrs }));

      expect(await screen.findByText(T.excludedTemplateKrTag)).toBeTruthy();

      const selectedGoalCard = screen.getByText(T.selectedGoals).closest('.ant-card');
      expect(selectedGoalCard).toBeTruthy();
      expect(within(selectedGoalCard as HTMLElement).getAllByText(T.employeeGoal1).length).toBeGreaterThan(0);

      const selectedKrCard = screen.getByText(T.selectedKrs).closest('.ant-card');
      expect(selectedKrCard).toBeTruthy();
      expect(within(selectedKrCard as HTMLElement).queryByText(T.templateKr)).toBeNull();
      expect(within(selectedKrCard as HTMLElement).getAllByText(T.templateQualityKr).length).toBeGreaterThan(0);
      expect(within(selectedKrCard as HTMLElement).getAllByText(T.templateDeliveryKr).length).toBeGreaterThan(0);
      expect(within(selectedKrCard as HTMLElement).getAllByText(T.deliveryKr).length).toBeGreaterThan(0);
    },
    10000
  );

  it(
    'keeps only the selected template key result excluded when a whole-goal exclusion was chosen first',
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
      fireEvent.mouseDown(screen.getByRole('combobox', { name: T.excludeSpecificTemplateGoals }));
      fireEvent.click((await screen.findAllByText(T.templateGoalOption1)).at(-1) as HTMLElement);
      expect(await screen.findByText(T.excludedTemplateGoalCountTag)).toBeTruthy();

      fireEvent.mouseDown(screen.getByRole('combobox', { name: T.excludeTemplateKeyResults }));
      fireEvent.click(await screen.findByText(T.templateKrOption1));
      await waitFor(() => {
        expect(screen.queryByText(T.excludedTemplateGoalCountTag)).toBeNull();
      });

      fireEvent.click(await screen.findByRole('button', { name: T.selectAllKrs }));

      const selectedGoalCard = screen.getByText(T.selectedGoals).closest('.ant-card');
      expect(selectedGoalCard).toBeTruthy();
      expect(within(selectedGoalCard as HTMLElement).getAllByText(T.employeeGoal1).length).toBeGreaterThan(0);

      const selectedKrCard = screen.getByText(T.selectedKrs).closest('.ant-card');
      expect(selectedKrCard).toBeTruthy();
      expect(within(selectedKrCard as HTMLElement).queryByText(T.templateKr)).toBeNull();
      expect(within(selectedKrCard as HTMLElement).getAllByText(T.templateQualityKr).length).toBeGreaterThan(0);
      expect(within(selectedKrCard as HTMLElement).getAllByText(T.templateDeliveryKr).length).toBeGreaterThan(0);
    },
    10000
  );

  it(
    'supports excluding a specific template goal from bulk selection',
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
      fireEvent.mouseDown(screen.getByRole('combobox', { name: T.excludeSpecificTemplateGoals }));
      fireEvent.click((await screen.findAllByText(T.templateGoalOption1)).at(-1) as HTMLElement);
      fireEvent.click(await screen.findByRole('button', { name: T.selectAllKrs }));

      expect(await screen.findByText(T.excludedTemplateGoalCountTag)).toBeTruthy();

      const selectedGoalCard = screen.getByText(T.selectedGoals).closest('.ant-card');
      expect(selectedGoalCard).toBeTruthy();
      expect(within(selectedGoalCard as HTMLElement).queryByText(T.employeeGoal1)).toBeNull();
      expect(within(selectedGoalCard as HTMLElement).getAllByText(T.employeeGoal2).length).toBeGreaterThan(0);

      const selectedKrCard = screen.getByText(T.selectedKrs).closest('.ant-card');
      expect(selectedKrCard).toBeTruthy();
      expect(within(selectedKrCard as HTMLElement).queryByText(T.templateKr)).toBeNull();
      expect(within(selectedKrCard as HTMLElement).getAllByText(T.deliveryKr).length).toBeGreaterThan(0);
    },
    10000
  );

  it(
    'supports limiting bulk scoring to multiple template goals and specific template key results',
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
      fireEvent.mouseDown(screen.getByRole('combobox', { name: T.onlyTemplateGoal }));
      fireEvent.click((await screen.findAllByText(T.templateGoalOption1)).at(-1) as HTMLElement);
      fireEvent.click((await screen.findAllByText(T.templateGoalOption2)).at(-1) as HTMLElement);
      fireEvent.mouseDown(screen.getByRole('combobox', { name: T.onlyTemplateKeyResults }));
      fireEvent.click(await screen.findByText(T.templateKrOption1));
      fireEvent.click(await screen.findByText(T.templateKrOption2));
      fireEvent.click(await screen.findByText(T.templateKrOption3));
      fireEvent.click(await screen.findByRole('button', { name: T.selectAllKrs }));

      expect(await screen.findByText(T.onlyTemplateGoalTag)).toBeTruthy();
      expect(screen.getByText(T.onlyTemplateGoalCountTagMulti)).toBeTruthy();
      expect(screen.getByText(T.onlyTemplateKrTagMulti)).toBeTruthy();

      const selectedGoalCard = screen.getByText(T.selectedGoals).closest('.ant-card');
      expect(selectedGoalCard).toBeTruthy();
      expect(within(selectedGoalCard as HTMLElement).getAllByText(T.employeeGoal1).length).toBeGreaterThan(0);
      expect(within(selectedGoalCard as HTMLElement).getAllByText(T.employeeGoal3).length).toBeGreaterThan(0);
      expect(within(selectedGoalCard as HTMLElement).queryByText(T.employeeGoal2)).toBeNull();

      const selectedKrCard = screen.getByText(T.selectedKrs).closest('.ant-card');
      expect(selectedKrCard).toBeTruthy();
      expect(within(selectedKrCard as HTMLElement).getAllByText(T.templateKr).length).toBeGreaterThan(0);
      expect(within(selectedKrCard as HTMLElement).getAllByText(T.templateQualityKr).length).toBeGreaterThan(0);
      expect(within(selectedKrCard as HTMLElement).getAllByText(T.templateDeliveryKr).length).toBeGreaterThan(0);
      expect(within(selectedKrCard as HTMLElement).queryByText(T.deliveryKr)).toBeNull();
    },
    10000
  );

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
      expect(screen.getByRole('button', { name: T.selectAllUnscoredKrs })).toBeTruthy();
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
      expect(screen.getAllByText(T.employeeGoal3).length).toBeGreaterThan(0);
      expect(screen.getAllByText(T.employeeGoal2).length).toBeGreaterThan(0);
      expect(screen.queryByText(T.readonlyGoal)).toBeNull();
      expect(screen.getByText(T.selectedKrs)).toBeTruthy();
      expect(screen.getAllByText(T.templateKr).length).toBeGreaterThan(0);
      expect(screen.getAllByText(T.templateQualityKr).length).toBeGreaterThan(0);
      expect(screen.getAllByText(T.templateDeliveryKr).length).toBeGreaterThan(0);
      expect(screen.getAllByText(T.deliveryKr).length).toBeGreaterThan(0);
      const selectedKrCard = screen.getByText(T.selectedKrs).closest('.ant-card');
      expect(selectedKrCard).toBeTruthy();
      expect(within(selectedKrCard as HTMLElement).queryByText(T.subjectiveKr)).toBeNull();
      expect(screen.getByRole('button', { name: T.batchSave })).toBeTruthy();
    },
    10000
  );

  it(
    'selects all unscored key results when using the unscored shortcut',
    async () => {
      ensureMatchMedia();

      const bulkScoreMock = vi.mocked(bulkLeaderKrScore);

      render(
        <QueryClientProvider client={new QueryClient()}>
          <AntApp>
            <LeaderWorkbenchPage />
          </AntApp>
        </QueryClientProvider>
      );

      fireEvent.click(await screen.findByRole('button', { name: T.batchTitle }));
      fireEvent.click(await screen.findByRole('button', { name: T.selectAllUnscoredKrs }));

      const selectedKrCard = (await screen.findByText(T.selectedKrs)).closest('.ant-card');
      expect(selectedKrCard).toBeTruthy();
      expect(within(selectedKrCard as HTMLElement).getAllByText(T.templateKr).length).toBeGreaterThan(0);
      expect(within(selectedKrCard as HTMLElement).getAllByText(T.subjectiveKr).length).toBeGreaterThan(0);
      expect(within(selectedKrCard as HTMLElement).queryByText(T.deliveryKr)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: T.batchSave }));

      await waitFor(() =>
        expect(bulkScoreMock).toHaveBeenCalledWith(
          expect.objectContaining({
            keyResultIds: ['g1-kr1', 'kr-2']
          })
        )
      );
    },
    10000
  );

  it(
    'allows removing a single key result after select all',
    async () => {
      ensureMatchMedia();

      const bulkScoreMock = vi.mocked(bulkLeaderKrScore);

      render(
        <QueryClientProvider client={new QueryClient()}>
          <AntApp>
            <LeaderWorkbenchPage />
          </AntApp>
        </QueryClientProvider>
      );

      fireEvent.click(await screen.findByRole('button', { name: T.batchTitle }));
      fireEvent.click(await screen.findByRole('button', { name: T.selectAllKrs }));

      expect(screen.getAllByText(T.templateKr).length).toBeGreaterThan(0);
      expect(screen.getByText('\u5df2\u9009\u5173\u952e\u7ed3\u679c')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: T.removeTemplateKr }));

      await waitFor(() => {
        expect(screen.queryAllByText(T.templateKr)).toHaveLength(0);
      });
      expect(screen.getAllByText(T.templateQualityKr).length).toBeGreaterThan(0);
      expect(screen.getAllByText(T.templateDeliveryKr).length).toBeGreaterThan(0);
      expect(screen.getAllByText(T.deliveryKr).length).toBeGreaterThan(0);

      fireEvent.click(screen.getByRole('button', { name: T.batchSave }));

      await waitFor(() =>
        expect(bulkScoreMock).toHaveBeenCalledWith(
          expect.objectContaining({
            keyResultIds: ['g1-kr2', 'g3-kr2', 'kr-1']
          })
        )
      );
    },
    10000
  );

  it(
    'supports assigning a custom score to all selected objective key results',
    async () => {
      ensureMatchMedia();

      const bulkScoreMock = vi.mocked(bulkLeaderKrScore);

      render(
        <QueryClientProvider client={new QueryClient()}>
          <AntApp>
            <LeaderWorkbenchPage />
          </AntApp>
        </QueryClientProvider>
      );

      fireEvent.click(await screen.findByRole('button', { name: T.batchTitle }));
      fireEvent.click(await screen.findByRole('button', { name: T.selectAllKrs }));
      fireEvent.click(await screen.findByRole('radio', { name: T.batchModeCustom }));

      const scoreInput = screen.getByRole('spinbutton', { name: T.batchCustomScoreLabel });
      fireEvent.change(scoreInput, { target: { value: '12' } });
      fireEvent.blur(scoreInput);

      fireEvent.click(screen.getByRole('button', { name: T.batchSave }));

      await waitFor(() =>
        expect(bulkScoreMock).toHaveBeenCalledWith(
          expect.objectContaining({
            score: 12
          })
        )
      );
    },
    10000
  );

  it(
    'blocks custom bulk scores that exceed the minimum selected key result points',
    async () => {
      ensureMatchMedia();

      const bulkScoreMock = vi.mocked(bulkLeaderKrScore);

      render(
        <QueryClientProvider client={new QueryClient()}>
          <AntApp>
            <LeaderWorkbenchPage />
          </AntApp>
        </QueryClientProvider>
      );

      fireEvent.click(await screen.findByRole('button', { name: T.batchTitle }));
      fireEvent.click(await screen.findByRole('button', { name: T.selectAllKrs }));
      fireEvent.click(await screen.findByRole('radio', { name: T.batchModeCustom }));

      const scoreInput = screen.getByRole('spinbutton', { name: T.batchCustomScoreLabel });
      fireEvent.change(scoreInput, { target: { value: '36' } });
      fireEvent.blur(scoreInput);

      expect(await screen.findByText(T.batchCustomScoreExceeded)).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: T.batchSave }));

      await waitFor(() => {
        expect(bulkScoreMock).not.toHaveBeenCalled();
      });
    },
    10000
  );

  it(
    'shows missing-proof warnings and only passes override after explicit confirmation',
    async () => {
      ensureMatchMedia();

      const bulkScoreMock = vi.mocked(bulkLeaderKrScore);
      bulkScoreMock
        .mockResolvedValueOnce({
          updatedCount: 1,
          skippedCount: 1,
          skipped: [
            {
              keyResultId: 'g1-kr1',
              reason: 'proof-missing'
            }
          ]
        })
        .mockResolvedValueOnce({
          updatedCount: 2,
          skippedCount: 0,
          skipped: []
        });

      render(
        <QueryClientProvider client={new QueryClient()}>
          <AntApp>
            <LeaderWorkbenchPage />
          </AntApp>
        </QueryClientProvider>
      );

      const batchButton = await screen.findByRole('button', { name: T.batchTitle });

      fireEvent.click(batchButton);
      fireEvent.click(await screen.findByRole('button', { name: T.selectAllKrs }));

      expect(await screen.findByText(T.batchMissingProofTitle)).toBeTruthy();
      expect(screen.getAllByText(T.templateKr).length).toBeGreaterThan(0);
      expect((screen.getByRole('checkbox', { name: T.batchAllowMissingProofs }) as HTMLInputElement).checked).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: T.batchSave }));

      await waitFor(() =>
        expect(bulkScoreMock).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            allowMissingProofs: false
          })
        )
      );

      fireEvent.click(await screen.findByRole('button', { name: T.batchTitle }));
      fireEvent.click(await screen.findByRole('button', { name: T.selectAllKrs }));
      fireEvent.click(await screen.findByRole('checkbox', { name: T.batchAllowMissingProofs }));
      fireEvent.click(screen.getByRole('button', { name: T.batchSave }));

      await waitFor(() =>
        expect(bulkScoreMock).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            allowMissingProofs: true
          })
        )
      );
    },
    15000
  );

  it(
    'supports matrix-style subjective bulk scoring by section',
    async () => {
      ensureMatchMedia();

      const bulkScoreMock = vi.mocked(bulkLeaderKrScore);

      render(
        <QueryClientProvider client={new QueryClient()}>
          <AntApp>
            <LeaderSubjectiveWorkbenchPage />
          </AntApp>
        </QueryClientProvider>
      );

      fireEvent.click(await screen.findByRole('button', { name: T.subjectiveBatchTitle }));
      const dialog = await screen.findByRole('dialog', { name: T.subjectiveBatchTitle });
      expect(dialog).toBeTruthy();
      expect(await within(dialog).findByText(T.subjectiveItem)).toBeTruthy();

      const scoreInput = within(dialog).getByRole('spinbutton');
      fireEvent.change(scoreInput, { target: { value: '9' } });
      fireEvent.blur(scoreInput);
      fireEvent.click(within(dialog).getByRole('button', { name: T.subjectiveBatchSave }));

      await waitFor(() =>
        expect(bulkScoreMock).toHaveBeenCalledWith(
          expect.objectContaining({
            sectionId: 'sec-1',
            overwriteExisting: true,
            entries: [{ keyResultId: 'kr-2', score: 9 }]
          })
        )
      );
    },
    10000
  );
});
