import { describe, expect, it } from 'vitest';
import {
  filterRankingEntries,
  filterRankingGoalBreakdown,
  formatQuarterScore,
  resolveRankingSelection
} from '../src/modules/leader/leader-ranking.helpers';
import type { LeaderRankingResponse } from '../src/shared/types/leader';

describe('leader ranking helpers', () => {
  it('falls back to the first available review group and ranked employee', () => {
    const result = resolveRankingSelection({
      year: 2026,
      quarter: 1,
      reviewGroups: [{ id: 'rg-1', name: 'Digital Group' }],
      selectedReviewGroup: null,
      seatSummary: [],
      ranking: [
        {
          employeeId: 'u-1',
          employeeName: 'Wang Min',
          sectionName: 'Platform Products',
          quarterScore: 90.7,
          goalCount: 1,
          keyResultCount: 3,
          scoredKeyResultCount: 3,
          proofCount: 0,
          currentGrade: 'A+',
          status: 'completed'
        }
      ],
      selectedEmployee: null
    } satisfies LeaderRankingResponse);

    expect(result).toEqual({
      reviewGroupId: 'rg-1',
      employeeId: 'u-1'
    });
  });

  it('formats empty and numeric quarter scores', () => {
    expect(formatQuarterScore(null)).toBe('-');
    expect(formatQuarterScore(90.65)).toBe('90.7');
  });

  it('filters ranking entries and goal breakdown by keyword', () => {
    const ranking: LeaderRankingResponse['ranking'] = [
      {
        employeeId: 'u-1',
        employeeName: '王敏',
        sectionName: '平台产品科',
        quarterScore: 91,
        goalCount: 1,
        keyResultCount: 3,
        scoredKeyResultCount: 3,
        proofCount: 0,
        currentGrade: 'A+',
        status: 'completed'
      },
      {
        employeeId: 'u-2',
        employeeName: '张晨',
        sectionName: '平台产品科',
        quarterScore: null,
        goalCount: 2,
        keyResultCount: 6,
        scoredKeyResultCount: 0,
        proofCount: 2,
        currentGrade: null,
        status: 'pending'
      }
    ];

    const breakdown: NonNullable<LeaderRankingResponse['selectedEmployee']>['goalBreakdown'] = [
      {
        goalId: 'g-1',
        goalCode: 'O1',
        goalName: '张晨 2026 年一季度 OKR',
        goalScore: 80,
        keyResultCount: 3,
        scoredKeyResultCount: 2,
        keyResults: [
          {
            keyResultId: 'kr-1',
            code: 'KR1',
            name: '完成 6 个版本交付',
            points: 35,
            reviewScore: 30.1
          }
        ]
      },
      {
        goalId: 'g-2',
        goalCode: 'O4',
        goalName: '张晨 知识库沉淀专项',
        goalScore: null,
        keyResultCount: 3,
        scoredKeyResultCount: 0,
        keyResults: [
          {
            keyResultId: 'kr-2',
            code: 'KR2',
            name: '知识库覆盖率达到 80%',
            points: 25,
            reviewScore: null
          }
        ]
      }
    ];

    expect(filterRankingEntries(ranking, '张晨')).toEqual([ranking[1]]);
    expect(filterRankingEntries(ranking, '平台产品科')).toEqual(ranking);
    expect(filterRankingGoalBreakdown(breakdown, '知识库')).toEqual([breakdown[1]]);
    expect(filterRankingGoalBreakdown(breakdown, 'KR1')).toEqual([breakdown[0]]);
  });
});
