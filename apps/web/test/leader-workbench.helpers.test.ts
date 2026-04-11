import { describe, expect, it } from 'vitest';
import {
  createScoreDrafts,
  filterWorkbenchEmployees,
  filterWorkbenchGoals,
  filterWorkbenchKeyResults,
  resolveWorkbenchSelection
} from '../src/modules/leader/leader-workbench.helpers';
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

  it('filters workbench employees, goals, and key results by keyword', () => {
    const employees: LeaderWorkbenchResponse['employees'] = [
      {
        id: 'u-1',
        name: '张晨',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        goalCount: 2,
        keyResultCount: 6,
        scoredKeyResultCount: 3,
        proofCount: 2,
        quarterScore: 63.6,
        status: 'in-progress'
      },
      {
        id: 'u-2',
        name: '王敏',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        goalCount: 1,
        keyResultCount: 3,
        scoredKeyResultCount: 3,
        proofCount: 0,
        quarterScore: 91,
        status: 'completed'
      }
    ];

    const goals: LeaderWorkbenchResponse['goals'] = [
      {
        id: 'g-1',
        code: 'O1',
        name: '张晨 2026 年一季度 OKR',
        description: '围绕平台交付效率推进季度工作',
        status: 'confirmed',
        totalPoints: 80,
        keyResultCount: 3,
        scoredKeyResultCount: 3,
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
        scoredKeyResultCount: 0,
        proofCount: 0,
        currentScore: null
      }
    ];

    const keyResults = [
      {
        id: 'kr-1',
        code: 'KR1',
        name: '完成 6 个版本交付',
        description: '关注季度版本交付节奏',
        points: 35,
        completionState: 'incomplete',
        reviewScore: 92.5,
        reviewComment: '表现稳定',
        proofCount: 2,
        proofs: []
      },
      {
        id: 'kr-2',
        code: 'KR2',
        name: '知识库覆盖率达到 80%',
        description: '补齐高频问题文档',
        points: 25,
        completionState: 'incomplete',
        reviewScore: 90,
        reviewComment: '继续推进',
        proofCount: 0,
        proofs: []
      }
    ];

    expect(filterWorkbenchEmployees(employees, '王敏')).toEqual([employees[1]]);
    expect(filterWorkbenchEmployees(employees, '平台产品科')).toEqual(employees);
    expect(filterWorkbenchGoals(goals, '知识库')).toEqual([goals[1]]);
    expect(filterWorkbenchGoals(goals, 'o1')).toEqual([goals[0]]);
    expect(filterWorkbenchKeyResults(keyResults, '版本交付')).toEqual([keyResults[0]]);
    expect(filterWorkbenchKeyResults(keyResults, 'KR2')).toEqual([keyResults[1]]);
  });
});
