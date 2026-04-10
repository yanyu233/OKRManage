import { describe, expect, it } from 'vitest';
import { formatQuarterScore, resolveRankingSelection } from '../src/modules/leader/leader-ranking.helpers';
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
});
