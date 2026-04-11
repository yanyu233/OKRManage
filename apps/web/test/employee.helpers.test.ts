import { describe, expect, it } from 'vitest';
import { buildYearOptions, filterEmployeeGoals, formatProofSize, resolveEmployeeGoalSelection } from '../src/modules/employee/employee.helpers';
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
            keyResultCount: 3,
            completedKeyResultCount: 1,
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
        name: '张晨 2026 年一季度 OKR',
        description: '围绕平台交付效率推进季度工作',
        status: 'confirmed',
        totalPoints: 80,
        keyResultCount: 3,
        completedKeyResultCount: 1,
        proofCount: 2,
        currentScore: 63.6
      },
      {
        id: 'g-2',
        code: 'O4',
        name: '张晨 知识库沉淀专项',
        description: '沉淀平台常见问题和交付案例',
        status: 'confirmed',
        totalPoints: 40,
        keyResultCount: 3,
        completedKeyResultCount: 0,
        proofCount: 0,
        currentScore: null
      }
    ];

    expect(filterEmployeeGoals(goals, '知识库')).toEqual([goals[1]]);
    expect(filterEmployeeGoals(goals, 'o1')).toEqual([goals[0]]);
    expect(filterEmployeeGoals(goals, '交付效率')).toEqual([goals[0]]);
    expect(filterEmployeeGoals(goals, '')).toEqual(goals);
  });

  it('builds descending year options from a start year', () => {
    expect(buildYearOptions(2026, 2028)).toEqual([2028, 2027, 2026]);
  });
});
