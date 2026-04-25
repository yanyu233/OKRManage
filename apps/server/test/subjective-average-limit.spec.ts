import {
  buildSubjectiveAverageLimitGroupKey,
  evaluateSubjectiveAverageLimit
} from '../src/modules/leader/subjective-average-limit';

describe('subjective average limit helpers', () => {
  it('counts unrated participants as zero when checking the average cap', () => {
    const result = evaluateSubjectiveAverageLimit(
      10,
      [
        { id: 'kr-1', score: 8 },
        { id: 'kr-2', score: null },
        { id: 'kr-3', score: 9 }
      ],
      new Map()
    );

    expect(result).toEqual({
      averageScore: 17 / 3,
      limitScore: 9,
      participantCount: 3,
      totalScore: 17,
      exceeded: false
    });
  });

  it('includes newly entered scores when checking the average cap', () => {
    const result = evaluateSubjectiveAverageLimit(
      10,
      [
        { id: 'kr-1', score: 8 },
        { id: 'kr-2', score: null },
        { id: 'kr-3', score: 9 }
      ],
      new Map([
        ['kr-2', 10],
        ['kr-3', 10]
      ])
    );

    expect(result).toEqual({
      averageScore: 28 / 3,
      limitScore: 9,
      participantCount: 3,
      totalScore: 28,
      exceeded: true
    });
  });

  it('builds a stable grouping key from item name and points', () => {
    expect(buildSubjectiveAverageLimitGroupKey('  目标任务综合评价 ', 10)).toBe('目标任务综合评价::10');
  });
});
