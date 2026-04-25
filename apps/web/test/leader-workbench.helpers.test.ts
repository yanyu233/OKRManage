import { describe, expect, it } from 'vitest';
import {
  ALL_FILTER_VALUE,
  buildBulkGoalFilterKey,
  buildBulkTemplateKeyResultFilterKey,
  buildBulkScorePreview,
  buildSubjectiveBulkAveragePreview,
  buildSubjectiveBulkScoreMatrix,
  buildWorkbenchFilterOptions,
  createScoreDrafts,
  createSubjectiveBulkScoreDrafts,
  filterBulkScoreEmployees,
  filterWorkbenchEmployees,
  filterWorkbenchGoals,
  filterWorkbenchKeyResults,
  resolveObjectiveBulkEmployeeIds,
  resolveWorkbenchQueueFilters,
  resolveWorkbenchQueueSelection,
  resolveWorkbenchSelection,
  selectAllBulkEmployeeIds,
  selectAllBulkKeyResultIds
} from '../src/modules/leader/leader-workbench.helpers';
import type { LeaderGoalDetail, LeaderWorkbenchResponse } from '../src/shared/types/leader';

describe('leader workbench helpers', () => {
  it('falls back to the first employee and goal when overrides are missing', () => {
    const result = resolveWorkbenchSelection({
      year: 2026,
      quarter: 1,
      employees: [
        {
          id: 'u-1',
          name: '张晨',
          sectionId: 'sec-1',
          sectionName: '平台产品科',
          reviewGroupId: 'rg-1',
          reviewGroupName: '信息化组',
          canScore: true,
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
          name: '目标一',
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
      selectedGoal: null
    } satisfies LeaderWorkbenchResponse);

    expect(result).toEqual({
      employeeId: 'u-1',
      goalId: 'g-1'
    });
  });

  it('does not reuse a stale goal from a different selected employee', () => {
    const result = resolveWorkbenchSelection(
      {
        year: 2026,
        quarter: 1,
        employees: [
          {
            id: 'u-1',
            name: '张晨',
            sectionId: 'sec-1',
            sectionName: '平台产品科',
            reviewGroupId: 'rg-1',
            reviewGroupName: '信息化组',
            canScore: true,
            goalCount: 2,
            keyResultCount: 6,
            scoredKeyResultCount: 3,
            missingProofKeyResultCount: 0,
            proofCount: 2,
            quarterScore: 63.6,
            status: 'in-progress'
          },
          {
            id: 'u-2',
            name: '李雷',
            sectionId: 'sec-2',
            sectionName: '解决方案科',
            reviewGroupId: 'rg-2',
            reviewGroupName: '运营组',
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
          name: '张晨',
          sectionId: 'sec-1',
          sectionName: '平台产品科',
          reviewGroupId: 'rg-1',
          reviewGroupName: '信息化组',
          canScore: true,
          goalCount: 2,
          keyResultCount: 6,
          scoredKeyResultCount: 3,
          missingProofKeyResultCount: 0,
          proofCount: 2,
          quarterScore: 63.6,
          status: 'in-progress'
        },
        goals: [
          {
            id: 'g-1',
            code: 'O1',
            name: '张晨 2026 年一季度 OKR',
            description: null,
            status: 'confirmed',
            totalPoints: 80,
            canScore: true,
            isTemplateGoal: false,
            keyResultCount: 3,
            scoredKeyResultCount: 3,
            missingProofKeyResultCount: 0,
            proofCount: 2,
            currentScore: 63.6
          }
        ],
        selectedGoal: {
          id: 'g-1',
          code: 'O1',
          name: '张晨 2026 年一季度 OKR',
          description: null,
          status: 'confirmed',
          totalPoints: 80,
          canScore: true,
          isTemplateGoal: false,
          keyResultCount: 3,
          scoredKeyResultCount: 3,
          missingProofKeyResultCount: 0,
          proofCount: 2,
          currentScore: 63.6,
          keyResults: []
        },
        bulkCatalog: []
      },
      {
        employeeId: 'u-2',
        goalId: null
      }
    );

    expect(result).toEqual({
      employeeId: 'u-2',
      goalId: null
    });
  });

  it('creates score drafts from key results', () => {
    const goal: LeaderGoalDetail = {
      id: 'g-1',
      code: 'O1',
      name: '目标一',
      description: null,
      status: 'confirmed',
      totalPoints: 80,
      canScore: true,
      isTemplateGoal: false,
      keyResultCount: 1,
      scoredKeyResultCount: 1,
      proofCount: 0,
      currentScore: 30.1,
      keyResults: [
        {
          id: 'kr-1',
          code: 'KR1',
          name: '完成 6 个版本交付',
          description: null,
          points: 35,
          scoreType: 'objective',
          canScore: true,
          completionState: 'incomplete',
          reviewScore: 30.1,
          reviewComment: '交付证据充分',
          proofCount: 0,
          proofs: []
        }
      ]
    };

    expect(createScoreDrafts(goal)).toEqual({
      'kr-1': {
        score: 30.1,
        comment: '交付证据充分'
      }
    });
  });

  it('filters workbench employees, goals, and key results by keyword', () => {
    const employees: LeaderWorkbenchResponse['employees'] = [
      {
        id: 'u-1',
        name: '张晨',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
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
        name: '王敏',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        canScore: true,
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
        canScore: true,
        isTemplateGoal: false,
        keyResultCount: 3,
        scoredKeyResultCount: 3,
        proofCount: 2,
        currentScore: 63.6
      },
      {
        id: 'g-2',
        code: 'O2',
        name: '张晨 知识库沉淀专项',
        description: '沉淀平台常见问题和交付案例',
        status: 'confirmed',
        totalPoints: 40,
        canScore: true,
        isTemplateGoal: true,
        keyResultCount: 3,
        scoredKeyResultCount: 0,
        proofCount: 0,
        currentScore: null
      }
    ];

    const keyResults: LeaderGoalDetail['keyResults'] = [
      {
        id: 'kr-1',
        code: 'KR1',
        name: '完成 6 个版本交付',
        description: '关注季度版本交付节奏',
        points: 35,
        scoreType: 'objective',
        canScore: true,
        completionState: 'incomplete',
        reviewScore: 30.1,
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
        scoreType: 'objective',
        canScore: false,
        completionState: 'incomplete',
        reviewScore: 19.5,
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

  it('derives batch filter options and employee ids from section/review-group filters', () => {
    const employees: LeaderWorkbenchResponse['employees'] = [
      {
        id: 'u-1',
        name: '张晨',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
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
        name: '王敏',
        sectionId: 'sec-2',
        sectionName: '解决方案科',
        reviewGroupId: 'rg-2',
        reviewGroupName: '运营组',
        canScore: false,
        goalCount: 1,
        keyResultCount: 3,
        scoredKeyResultCount: 3,
        proofCount: 0,
        quarterScore: 91,
        status: 'completed'
      },
      {
        id: 'u-3',
        name: '李雷',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        canScore: true,
        goalCount: 3,
        keyResultCount: 4,
        scoredKeyResultCount: 1,
        proofCount: 1,
        quarterScore: 72,
        status: 'in-progress'
      }
    ];

    expect(buildWorkbenchFilterOptions(employees)).toEqual({
      sections: [
        { value: ALL_FILTER_VALUE, label: '全部' },
        { value: 'sec-1', label: '平台产品科' },
        { value: 'sec-2', label: '解决方案科' }
      ],
      reviewGroups: [
        { value: ALL_FILTER_VALUE, label: '全部' },
        { value: 'rg-1', label: '信息化组' },
        { value: 'rg-2', label: '运营组' }
      ]
    });

    expect(filterBulkScoreEmployees(employees, { sectionId: 'sec-1' })).toEqual([employees[0], employees[2]]);
    expect(filterBulkScoreEmployees(employees, { reviewGroupId: 'rg-2' })).toEqual([employees[1]]);
    expect(selectAllBulkEmployeeIds(employees, { sectionId: 'sec-1' })).toEqual(['u-1', 'u-3']);
  });

  it('clears an invalid review group when the section filter changes', () => {
    const employees: LeaderWorkbenchResponse['employees'] = [
      {
        id: 'u-1',
        name: '张晨',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        canScore: true,
        goalCount: 2,
        keyResultCount: 6,
        scoredKeyResultCount: 3,
        missingProofKeyResultCount: 0,
        proofCount: 2,
        quarterScore: 63.6,
        status: 'in-progress'
      },
      {
        id: 'u-2',
        name: '李雷',
        sectionId: 'sec-2',
        sectionName: '解决方案科',
        reviewGroupId: 'rg-2',
        reviewGroupName: '运营组',
        canScore: false,
        goalCount: 1,
        keyResultCount: 2,
        scoredKeyResultCount: 0,
        missingProofKeyResultCount: 2,
        proofCount: 0,
        quarterScore: null,
        status: 'pending'
      }
    ];

    expect(
      resolveWorkbenchQueueFilters(employees, {
        sectionId: 'sec-2',
        reviewGroupId: 'rg-1'
      })
    ).toEqual({
      sectionId: 'sec-2',
      reviewGroupId: null
    });
  });

  it('applies queue filters consistently across repeated section and review-group changes', () => {
    const employees: LeaderWorkbenchResponse['employees'] = [
      {
        id: 'u-1',
        name: '张晨',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        canScore: true,
        goalCount: 2,
        keyResultCount: 6,
        scoredKeyResultCount: 3,
        missingProofKeyResultCount: 0,
        proofCount: 2,
        quarterScore: 63.6,
        status: 'in-progress'
      },
      {
        id: 'u-2',
        name: '李雷',
        sectionId: 'sec-2',
        sectionName: '解决方案科',
        reviewGroupId: 'rg-2',
        reviewGroupName: '运营组',
        canScore: false,
        goalCount: 1,
        keyResultCount: 2,
        scoredKeyResultCount: 0,
        missingProofKeyResultCount: 2,
        proofCount: 0,
        quarterScore: null,
        status: 'pending'
      }
    ];

    const section1Filters = resolveWorkbenchQueueFilters(employees, {
      sectionId: 'sec-1',
      reviewGroupId: null
    });
    expect(filterBulkScoreEmployees(employees, section1Filters).map((employee) => employee.id)).toEqual(['u-1']);

    const section2Filters = resolveWorkbenchQueueFilters(employees, {
      sectionId: 'sec-2',
      reviewGroupId: 'rg-1'
    });
    expect(section2Filters).toEqual({
      sectionId: 'sec-2',
      reviewGroupId: null
    });
    expect(filterBulkScoreEmployees(employees, section2Filters).map((employee) => employee.id)).toEqual(['u-2']);

    const group1Filters = resolveWorkbenchQueueFilters(employees, {
      sectionId: null,
      reviewGroupId: 'rg-1'
    });
    expect(filterBulkScoreEmployees(employees, group1Filters).map((employee) => employee.id)).toEqual(['u-1']);

    const group2Filters = resolveWorkbenchQueueFilters(employees, {
      sectionId: null,
      reviewGroupId: 'rg-2'
    });
    expect(filterBulkScoreEmployees(employees, group2Filters).map((employee) => employee.id)).toEqual(['u-2']);
  });

  it('switches to the first employee in the next review group immediately', () => {
    const employees: LeaderWorkbenchResponse['employees'] = [
      {
        id: 'u-1',
        name: '张晨',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        canScore: true,
        goalCount: 2,
        keyResultCount: 6,
        scoredKeyResultCount: 3,
        missingProofKeyResultCount: 0,
        proofCount: 2,
        quarterScore: 63.6,
        status: 'in-progress'
      },
      {
        id: 'u-2',
        name: '王敏',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-2',
        reviewGroupName: '运营组',
        canScore: true,
        goalCount: 1,
        keyResultCount: 3,
        scoredKeyResultCount: 0,
        missingProofKeyResultCount: 1,
        proofCount: 1,
        quarterScore: 88.5,
        status: 'pending'
      }
    ];

    expect(
      resolveWorkbenchQueueSelection(employees, {
        sectionId: null,
        reviewGroupId: 'rg-2',
        keyword: '',
        onlyWithProofs: false,
        selectedEmployeeId: 'u-1'
      })
    ).toEqual({
      sectionId: null,
      reviewGroupId: 'rg-2',
      employeeId: 'u-2'
    });
  });

  it('excludes readonly employees from bulk preview rows and goals', () => {
    const preview = buildBulkScorePreview(
      [
        {
          id: 'u-1',
          name: '张晨',
          sectionId: 'sec-1',
          sectionName: '平台产品科',
          reviewGroupId: 'rg-1',
          reviewGroupName: '信息化组',
          canScore: true,
          goals: [
            {
              id: 'g-1',
              code: 'O1',
              name: '张晨 2026 年一季度 OKR',
              isTemplateGoal: false,
              keyResults: [
                {
                  id: 'kr-1',
                  code: 'KR1',
                  name: '完成 6 个版本交付',
                  points: 35,
                  scoreType: 'objective',
                  reviewScore: 30.1
                }
              ]
            }
          ]
        },
        {
          id: 'u-2',
          name: '李雷',
          sectionId: 'sec-2',
          sectionName: '解决方案科',
          reviewGroupId: 'rg-2',
          reviewGroupName: '运营组',
          canScore: false,
          goals: [
            {
              id: 'g-2',
              code: 'O3',
              name: '李雷 运营支持专项',
              isTemplateGoal: false,
              keyResults: [
                {
                  id: 'kr-2',
                  code: 'KR1',
                  name: '运营资料补齐',
                  points: 20,
                  scoreType: 'objective',
                  reviewScore: null
                }
              ]
            }
          ]
        }
      ],
      {
        sectionId: null,
        reviewGroupId: null,
        employeeIds: ['u-1', 'u-2'],
        goalIds: [],
        keyResultIds: null,
        excludeTemplateGoals: false
      }
    );

    expect(preview.employees.map((employee) => employee.id)).toEqual(['u-1']);
    expect(preview.goals.map((goal) => goal.goalId)).toEqual(['g-1']);
    expect(preview.rows.map((row) => row.keyResultId)).toEqual(['kr-1']);
    expect(preview.readonlyRows).toBe(0);
  });

  it('supports excluding a specific template key result from bulk preview and select-all', () => {
    const catalog: LeaderWorkbenchResponse['bulkCatalog'] = [
      {
        id: 'u-1',
        name: '张晨',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        canScore: true,
        goals: [
          {
            id: 'g-1',
            code: 'O1',
            name: '平台模板目标',
            isTemplateGoal: true,
            keyResults: [
              {
                id: 'kr-template',
                code: 'KR1',
                name: '模板客观项',
                points: 20,
                scoreType: 'objective',
                reviewScore: null,
                proofCount: 0,
                hasProofs: false,
                isProofMissing: true
              }
            ]
          },
          {
            id: 'g-2',
            code: 'O2',
            name: '张晨 2026 年一季度 OKR',
            isTemplateGoal: false,
            keyResults: [
              {
                id: 'kr-custom',
                code: 'KR1',
                name: '完成 6 个版本交付',
                points: 35,
                scoreType: 'objective',
                reviewScore: 30.1,
                proofCount: 2,
                hasProofs: true,
                isProofMissing: false
              }
            ]
          }
        ]
      }
    ];

    const excludedTemplateKeyResultKeys = [
      buildBulkTemplateKeyResultFilterKey(
        { code: 'O1', name: '平台模板目标' },
        { code: 'KR1', name: '模板客观项' }
      )
    ];

    expect(
      selectAllBulkKeyResultIds(catalog, {
        sectionId: null,
        reviewGroupId: null,
        employeeIds: ['u-1'],
        goalIds: [],
        excludeTemplateGoals: false,
        excludedTemplateKeyResultKeys
      })
    ).toEqual(['kr-custom']);

    const preview = buildBulkScorePreview(catalog, {
      sectionId: null,
      reviewGroupId: null,
      employeeIds: ['u-1'],
      goalIds: [],
      keyResultIds: ['kr-template', 'kr-custom'],
      excludeTemplateGoals: false,
      excludedTemplateKeyResultKeys
    });

    expect(preview.rows.map((row) => row.keyResultId)).toEqual(['kr-custom']);
    expect(preview.goals.map((goal) => goal.goalId)).toEqual(['g-2']);
  });

  it('supports selecting a single template goal and its key results only', () => {
    const catalog: LeaderWorkbenchResponse['bulkCatalog'] = [
      {
        id: 'u-1',
        name: '张晨',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        canScore: true,
        goals: [
          {
            id: 'g-template-1',
            code: 'TO1',
            name: '模板目标一',
            isTemplateGoal: true,
            keyResults: [
              {
                id: 'kr-template-1',
                code: 'KR1',
                name: '模板关键结果一',
                points: 10,
                scoreType: 'objective',
                reviewScore: null,
                proofCount: 0,
                hasProofs: false,
                isProofMissing: true
              },
              {
                id: 'kr-template-2',
                code: 'KR2',
                name: '模板关键结果二',
                points: 10,
                scoreType: 'objective',
                reviewScore: null,
                proofCount: 0,
                hasProofs: false,
                isProofMissing: true
              }
            ]
          },
          {
            id: 'g-template-2',
            code: 'TO2',
            name: '模板目标二',
            isTemplateGoal: true,
            keyResults: [
              {
                id: 'kr-template-3',
                code: 'KR1',
                name: '另一个模板关键结果',
                points: 8,
                scoreType: 'objective',
                reviewScore: null,
                proofCount: 0,
                hasProofs: false,
                isProofMissing: true
              }
            ]
          },
          {
            id: 'g-custom',
            code: 'O1',
            name: '张晨自建目标',
            isTemplateGoal: false,
            keyResults: [
              {
                id: 'kr-custom',
                code: 'KR1',
                name: '自建关键结果',
                points: 20,
                scoreType: 'objective',
                reviewScore: null,
                proofCount: 1,
                hasProofs: true,
                isProofMissing: false
              }
            ]
          }
        ]
      }
    ];

    const includedTemplateGoalKeys = [buildBulkGoalFilterKey({
      code: 'TO1',
      name: '模板目标一',
      isTemplateGoal: true
    })];
    const includedTemplateKeyResultKeys = [
      buildBulkTemplateKeyResultFilterKey(
        { code: 'TO1', name: '模板目标一' },
        { code: 'KR2', name: '模板关键结果二' }
      )
    ];

    expect(
      selectAllBulkKeyResultIds(catalog, {
        sectionId: null,
        reviewGroupId: null,
        employeeIds: ['u-1'],
        goalIds: [],
        excludeTemplateGoals: false,
        excludedTemplateGoalKeys: [],
        excludedTemplateKeyResultKeys: [],
        includedTemplateGoalKeys,
        includedTemplateKeyResultKeys
      })
    ).toEqual(['kr-template-2']);

    const preview = buildBulkScorePreview(catalog, {
      sectionId: null,
      reviewGroupId: null,
      employeeIds: ['u-1'],
      goalIds: [],
      keyResultIds: ['kr-template-1', 'kr-template-2', 'kr-template-3', 'kr-custom'],
      excludeTemplateGoals: false,
      excludedTemplateGoalKeys: [],
      excludedTemplateKeyResultKeys: [],
      includedTemplateGoalKeys,
      includedTemplateKeyResultKeys
    });

    expect(preview.rows.map((row) => row.keyResultId)).toEqual(['kr-template-2']);
    expect(preview.goals.map((goal) => goal.goalId)).toEqual(['g-template-1']);
  });

  it('supports selecting multiple template goals and multiple template key results', () => {
    const catalog: LeaderWorkbenchResponse['bulkCatalog'] = [
      {
        id: 'u-1',
        name: '张晨',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        canScore: true,
        goals: [
          {
            id: 'g-template-1',
            code: 'TO1',
            name: '模板目标一',
            isTemplateGoal: true,
            keyResults: [
              {
                id: 'kr-template-1',
                code: 'KR1',
                name: '模板关键结果一',
                points: 10,
                scoreType: 'objective',
                reviewScore: null,
                proofCount: 0,
                hasProofs: false,
                isProofMissing: true
              },
              {
                id: 'kr-template-2',
                code: 'KR2',
                name: '模板关键结果二',
                points: 15,
                scoreType: 'objective',
                reviewScore: null,
                proofCount: 1,
                hasProofs: true,
                isProofMissing: false
              }
            ]
          },
          {
            id: 'g-template-2',
            code: 'TO2',
            name: '模板目标二',
            isTemplateGoal: true,
            keyResults: [
              {
                id: 'kr-template-3',
                code: 'KR1',
                name: '另一个模板关键结果',
                points: 8,
                scoreType: 'objective',
                reviewScore: null,
                proofCount: 1,
                hasProofs: true,
                isProofMissing: false
              }
            ]
          },
          {
            id: 'g-custom',
            code: 'O1',
            name: '张晨自建目标',
            isTemplateGoal: false,
            keyResults: [
              {
                id: 'kr-custom',
                code: 'KR1',
                name: '自建关键结果',
                points: 20,
                scoreType: 'objective',
                reviewScore: null,
                proofCount: 1,
                hasProofs: true,
                isProofMissing: false
              }
            ]
          }
        ]
      }
    ];

    const includedTemplateGoalKeys = [
      buildBulkGoalFilterKey({
        code: 'TO1',
        name: '模板目标一',
        isTemplateGoal: true
      }),
      buildBulkGoalFilterKey({
        code: 'TO2',
        name: '模板目标二',
        isTemplateGoal: true
      })
    ];
    const includedTemplateKeyResultKeys = [
      buildBulkTemplateKeyResultFilterKey(
        { code: 'TO1', name: '模板目标一' },
        { code: 'KR1', name: '模板关键结果一' }
      ),
      buildBulkTemplateKeyResultFilterKey(
        { code: 'TO1', name: '模板目标一' },
        { code: 'KR2', name: '模板关键结果二' }
      ),
      buildBulkTemplateKeyResultFilterKey(
        { code: 'TO2', name: '模板目标二' },
        { code: 'KR1', name: '另一个模板关键结果' }
      )
    ];

    expect(
      selectAllBulkKeyResultIds(catalog, {
        sectionId: null,
        reviewGroupId: null,
        employeeIds: ['u-1'],
        goalIds: [],
        excludeTemplateGoals: false,
        excludedTemplateGoalKeys: [],
        excludedTemplateKeyResultKeys: [],
        includedTemplateGoalKeys,
        includedTemplateKeyResultKeys
      })
    ).toEqual(['kr-template-1', 'kr-template-2', 'kr-template-3']);

    const preview = buildBulkScorePreview(catalog, {
      sectionId: null,
      reviewGroupId: null,
      employeeIds: ['u-1'],
      goalIds: [],
      keyResultIds: ['kr-template-1', 'kr-template-2', 'kr-template-3', 'kr-custom'],
      excludeTemplateGoals: false,
      excludedTemplateGoalKeys: [],
      excludedTemplateKeyResultKeys: [],
      includedTemplateGoalKeys,
      includedTemplateKeyResultKeys
    });

    expect(preview.rows.map((row) => row.keyResultId)).toEqual(['kr-template-1', 'kr-template-2', 'kr-template-3']);
    expect(preview.goals.map((goal) => goal.goalId)).toEqual(['g-template-1', 'g-template-2']);
  });

  it('supports excluding a specific template goal from bulk preview and select-all', () => {
    const catalog: LeaderWorkbenchResponse['bulkCatalog'] = [
      {
        id: 'u-1',
        name: '张晨',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        canScore: true,
        goals: [
          {
            id: 'g-template-1',
            code: 'TO1',
            name: '模板目标一',
            isTemplateGoal: true,
            keyResults: [
              {
                id: 'kr-template-1',
                code: 'KR1',
                name: '模板关键结果一',
                points: 10,
                scoreType: 'objective',
                reviewScore: null,
                proofCount: 0,
                hasProofs: false,
                isProofMissing: true
              }
            ]
          },
          {
            id: 'g-template-2',
            code: 'TO2',
            name: '模板目标二',
            isTemplateGoal: true,
            keyResults: [
              {
                id: 'kr-template-2',
                code: 'KR1',
                name: '模板关键结果二',
                points: 8,
                scoreType: 'objective',
                reviewScore: null,
                proofCount: 0,
                hasProofs: false,
                isProofMissing: true
              }
            ]
          },
          {
            id: 'g-custom',
            code: 'O1',
            name: '张晨自建目标',
            isTemplateGoal: false,
            keyResults: [
              {
                id: 'kr-custom',
                code: 'KR1',
                name: '自建关键结果',
                points: 20,
                scoreType: 'objective',
                reviewScore: null,
                proofCount: 1,
                hasProofs: true,
                isProofMissing: false
              }
            ]
          }
        ]
      }
    ];

    const excludedTemplateGoalKeys = [
      buildBulkGoalFilterKey({
        code: 'TO1',
        name: '模板目标一',
        isTemplateGoal: true
      })
    ];

    expect(
      selectAllBulkKeyResultIds(catalog, {
        sectionId: null,
        reviewGroupId: null,
        employeeIds: ['u-1'],
        goalIds: [],
        excludeTemplateGoals: false,
        excludedTemplateGoalKeys,
        excludedTemplateKeyResultKeys: [],
        includedTemplateGoalKeys: [],
        includedTemplateKeyResultKeys: []
      })
    ).toEqual(['kr-template-2', 'kr-custom']);

    const preview = buildBulkScorePreview(catalog, {
      sectionId: null,
      reviewGroupId: null,
      employeeIds: ['u-1'],
      goalIds: [],
      keyResultIds: ['kr-template-1', 'kr-template-2', 'kr-custom'],
      excludeTemplateGoals: false,
      excludedTemplateGoalKeys,
      excludedTemplateKeyResultKeys: [],
      includedTemplateGoalKeys: [],
      includedTemplateKeyResultKeys: []
    });

    expect(preview.rows.map((row) => row.keyResultId)).toEqual(['kr-template-2', 'kr-custom']);
    expect(preview.goals.map((goal) => goal.goalId)).toEqual(['g-template-2', 'g-custom']);
  });

  it('expands objective bulk scoring to all scorable employees in scope', () => {
    expect(resolveObjectiveBulkEmployeeIds(['u-1'], ['u-1', 'u-2'])).toEqual(['u-1', 'u-2']);
    expect(resolveObjectiveBulkEmployeeIds([], ['u-1', 'u-2'])).toEqual(['u-1', 'u-2']);
    expect(resolveObjectiveBulkEmployeeIds(['u-3'], ['u-1', 'u-2'])).toEqual(['u-1', 'u-2']);
  });

  it('builds a subjective bulk matrix and average preview by section', () => {
    const catalog: LeaderWorkbenchResponse['bulkCatalog'] = [
      {
        id: 'u-1',
        name: '张晨',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        canScore: true,
        goals: [
          {
            id: 'g-1',
            code: 'O1',
            name: '季度综合评价',
            isTemplateGoal: false,
            keyResults: [
              {
                id: 'kr-1',
                code: 'KR1',
                name: '目标任务综合评价',
                points: 10,
                scoreType: 'subjective',
                reviewScore: 8,
                proofCount: 0,
                hasProofs: false,
                isProofMissing: false
              }
            ]
          }
        ]
      },
      {
        id: 'u-2',
        name: '王敏',
        sectionId: 'sec-1',
        sectionName: '平台产品科',
        reviewGroupId: 'rg-1',
        reviewGroupName: '信息化组',
        canScore: true,
        goals: [
          {
            id: 'g-2',
            code: 'O1',
            name: '季度综合评价',
            isTemplateGoal: false,
            keyResults: [
              {
                id: 'kr-2',
                code: 'KR1',
                name: '目标任务综合评价',
                points: 10,
                scoreType: 'subjective',
                reviewScore: null,
                proofCount: 0,
                hasProofs: false,
                isProofMissing: false
              }
            ]
          }
        ]
      }
    ];

    const matrix = buildSubjectiveBulkScoreMatrix(catalog, {
      sectionId: 'sec-1'
    });
    const drafts = createSubjectiveBulkScoreDrafts(matrix.rows);
    const previewBeforeInput = buildSubjectiveBulkAveragePreview(matrix.columns, matrix.rows, drafts);
    drafts['kr-2'] = {
      score: 10,
      comment: ''
    };
    const preview = buildSubjectiveBulkAveragePreview(matrix.columns, matrix.rows, drafts);

    expect(matrix.columns).toHaveLength(1);
    expect(matrix.rows).toHaveLength(2);
    expect(matrix.rows[0]?.cells[matrix.columns[0]?.key ?? '']?.keyResultId).toBe('kr-1');
    expect(matrix.rows[0]?.cells[matrix.columns[0]?.key ?? '']).toMatchObject({
      keyResultCode: 'KR1',
      keyResultName: matrix.columns[0]?.name
    });
    expect(previewBeforeInput[0]).toMatchObject({
      averageScore: 4,
      participantCount: 2,
      maxAverageScore: 9,
      exceeded: false
    });
    expect(preview).toEqual([
      expect.objectContaining({
        name: '目标任务综合评价',
        averageScore: 9,
        participantCount: 2,
        maxAverageScore: 9,
        exceeded: false
      })
    ]);
  });
});
