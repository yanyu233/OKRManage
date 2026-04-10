import { describe, expect, it } from 'vitest';
import { createScoreDrafts, resolveWorkbenchSelection } from '../src/modules/leader/leader-workbench.helpers';
import type { LeaderWorkbenchResponse } from '../src/shared/types/leader';

describe('leader workbench helpers', () => {
  it('falls back to the first employee and goal when overrides are missing', () => {
    const result = resolveWorkbenchSelection({
      year: 2026,
      quarter: 1,
      employees: [
        {
          id: 'u-1',
          name: 'Zhang Chen',
          sectionName: 'Platform Products',
          reviewGroupId: 'rg-1',
          reviewGroupName: 'Digital Group',
          goalCount: 2,
          keyResultCount: 6,
          scoredKeyResultCount: 3,
          proofCount: 2,
          quarterScore: 63.6,
          status: 'in-progress'
        }
      ],
      selectedEmployee: null,
      goals: [
        {
          id: 'g-1',
          code: 'O1',
          name: 'Goal One',
          description: null,
          status: 'confirmed',
          totalPoints: 80,
          keyResultCount: 3,
          scoredKeyResultCount: 3,
          proofCount: 2,
          currentScore: 63.6
        }
      ],
      selectedGoal: null
    } satisfies LeaderWorkbenchResponse);

    expect(result).toEqual({
      employeeId: 'u-1',
      goalId: 'g-1'
    });
  });

  it('creates score drafts from key results', () => {
    const drafts = createScoreDrafts({
      id: 'g-1',
      code: 'O1',
      name: 'Goal One',
      description: null,
      status: 'confirmed',
      totalPoints: 80,
      keyResultCount: 1,
      scoredKeyResultCount: 1,
      proofCount: 0,
      currentScore: 92.5,
      keyResults: [
        {
          id: 'kr-1',
          code: 'KR1',
          name: 'Deliver 6 releases',
          description: null,
          points: 35,
          completionState: 'incomplete',
          reviewScore: 92.5,
          reviewComment: 'Strong delivery evidence',
          proofCount: 0,
          proofs: []
        }
      ]
    });

    expect(drafts).toEqual({
      'kr-1': {
        score: 92.5,
        comment: 'Strong delivery evidence'
      }
    });
  });
});
