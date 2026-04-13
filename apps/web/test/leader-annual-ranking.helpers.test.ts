import { describe, expect, it } from 'vitest';
import {
  filterAnnualRankingEntries,
  formatAnnualScore,
  resolveAnnualRankingSelection
} from '../src/modules/leader/leader-annual-ranking.helpers';
import type { LeaderAnnualRankingResponse } from '../src/shared/types/leader';

describe('leader annual ranking helpers', () => {
  it('falls back to the first ranked employee', () => {
    const result = resolveAnnualRankingSelection({
      year: 2026,
      ranking: [
        {
          employeeId: 'u-1',
          employeeName: '王敏',
          sectionName: '平台产品科',
          reviewGroupName: '信息化组',
          annualScore: 156.7,
          quarterScores: [
            { quarter: 1, score: 90.7 },
            { quarter: 2, score: 66 },
            { quarter: 3, score: 0 },
            { quarter: 4, score: 0 }
          ]
        }
      ],
      selectedEmployee: null
    } satisfies LeaderAnnualRankingResponse);

    expect(result).toEqual({ employeeId: 'u-1' });
  });

  it('formats empty and numeric annual scores', () => {
    expect(formatAnnualScore(null)).toBe('-');
    expect(formatAnnualScore(156.65)).toBe('156.7');
  });

  it('filters annual ranking entries by employee, section and group keyword', () => {
    const ranking: LeaderAnnualRankingResponse['ranking'] = [
      {
        employeeId: 'u-1',
        employeeName: '王敏',
        sectionName: '平台产品科',
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
        sectionName: '解决方案科',
        reviewGroupName: '运营组',
        annualScore: 49.5,
        quarterScores: [
          { quarter: 1, score: 49.5 },
          { quarter: 2, score: 0 },
          { quarter: 3, score: 0 },
          { quarter: 4, score: 0 }
        ]
      }
    ];

    expect(filterAnnualRankingEntries(ranking, '王敏')).toEqual([ranking[0]]);
    expect(filterAnnualRankingEntries(ranking, '运营组')).toEqual([ranking[1]]);
    expect(filterAnnualRankingEntries(ranking, '平台产品科')).toEqual([ranking[0]]);
  });
});
