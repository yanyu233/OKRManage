import { describe, expect, it } from 'vitest';
import {
  buildYearOptions,
  filterEmployeeGoals,
  formatProofSize,
  isEmployeeGoalActionRequired,
  resolveEmployeeGoalSelection
} from '../src/modules/employee/employee.helpers';
import type { EmployeeOkrResponse } from '../src/shared/types/employee';

describe('employee helpers', () => {
  it('falls back to the first goal when no goal is selected', () => {
    const result = resolveEmployeeGoalSelection(
      {
        year: 2026,
        quarter: 1,
        employee: {
          id: 'u-1',
          name: 'Zhang Chen',
          sectionName: 'Platform Products',
          reviewGroupName: 'Digital Group',
          goalCount: 2,
          keyResultCount: 6,
          completedKeyResultCount: 1,
          missingProofKeyResultCount: 0,
          proofCount: 2,
          quarterScore: 63.6
        },
        goals: [
          {
            id: 'g-1',
            code: 'O1',
            name: 'Goal One',
            description: null,
            status: 'confirmed',
            totalPoints: 80,
            isTemplateGoal: false,
            keyResultCount: 3,
            completedKeyResultCount: 1,
            missingProofKeyResultCount: 0,
            proofCount: 2,
            currentScore: 63.6
          }
        ]
      } satisfies EmployeeOkrResponse,
      null
    );

    expect(result).toBe('g-1');
  });

  it('formats proof sizes in KB and MB', () => {
    expect(formatProofSize(512)).toBe('512 B');
    expect(formatProofSize(2 * 1024)).toBe('2.0 KB');
    expect(formatProofSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('filters goals by code, name, or description keyword', () => {
    const goals: EmployeeOkrResponse['goals'] = [
      {
        id: 'g-1',
        code: 'O1',
        name: 'Platform delivery',
        description: 'Quarterly delivery efficiency improvement',
        status: 'confirmed',
        totalPoints: 80,
        isTemplateGoal: false,
        keyResultCount: 3,
        completedKeyResultCount: 1,
        missingProofKeyResultCount: 1,
        proofCount: 2,
        currentScore: 63.6
      },
      {
        id: 'g-2',
        code: 'O4',
        name: 'Knowledge base improvement',
        description: 'Archive reusable issue resolutions and delivery cases',
        status: 'confirmed',
        totalPoints: 40,
        isTemplateGoal: true,
        keyResultCount: 3,
        completedKeyResultCount: 0,
        missingProofKeyResultCount: 0,
        proofCount: 0,
        currentScore: null
      }
    ];

    expect(filterEmployeeGoals(goals, 'knowledge')).toEqual([goals[1]]);
    expect(filterEmployeeGoals(goals, 'o1')).toEqual([goals[0]]);
    expect(filterEmployeeGoals(goals, 'delivery efficiency')).toEqual([goals[0]]);
    expect(filterEmployeeGoals(goals, '')).toEqual(goals);
  });

  it('builds descending year options from a start year', () => {
    expect(buildYearOptions(2026, 2028)).toEqual([2028, 2027, 2026]);
  });

  it('does not treat template goals without proofs as pending material work', () => {
    expect(
      isEmployeeGoalActionRequired({
        isTemplateGoal: true,
        completedKeyResultCount: 1,
        keyResultCount: 2,
        missingProofKeyResultCount: 1
      })
    ).toBe(true);

    expect(
      isEmployeeGoalActionRequired({
        isTemplateGoal: true,
        completedKeyResultCount: 2,
        keyResultCount: 2,
        missingProofKeyResultCount: 2
      })
    ).toBe(false);
  });
});
