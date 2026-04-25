import type { LeaderGoalDetail, LeaderWorkbenchResponse } from '../../shared/types/leader';
import { normalizeKeyword } from '../../shared/ui/toolbar-options';

export const ALL_FILTER_VALUE = '__all__';

export type ScoreDraft = {
  score: number | null;
  comment: string;
};

export function buildBulkGoalFilterKey(
  goal: Pick<LeaderWorkbenchResponse['bulkCatalog'][number]['goals'][number], 'code' | 'name' | 'isTemplateGoal'>
) {
  return `${goal.isTemplateGoal ? 'template' : 'custom'}::${goal.code}::${goal.name}`;
}

export function buildBulkKeyResultFilterKey(
  goal: Pick<LeaderWorkbenchResponse['bulkCatalog'][number]['goals'][number], 'code' | 'name' | 'isTemplateGoal'>,
  keyResult: Pick<LeaderWorkbenchResponse['bulkCatalog'][number]['goals'][number]['keyResults'][number], 'code' | 'name'>
) {
  return `${buildBulkGoalFilterKey(goal)}::${keyResult.code}::${keyResult.name}`;
}

export function buildBulkTemplateKeyResultFilterKey(
  goal: Pick<LeaderWorkbenchResponse['bulkCatalog'][number]['goals'][number], 'code' | 'name'>,
  keyResult: Pick<LeaderWorkbenchResponse['bulkCatalog'][number]['goals'][number]['keyResults'][number], 'code' | 'name'>
) {
  return buildBulkKeyResultFilterKey(
    {
      ...goal,
      isTemplateGoal: true
    },
    keyResult
  );
}

export function resolveWorkbenchSelection(
  payload: LeaderWorkbenchResponse,
  current?: { employeeId?: string | null; goalId?: string | null }
) {
  const employeeIds = new Set(payload.employees.map((employee) => employee.id));
  const goalIds = new Set(payload.goals.map((goal) => goal.id));
  const currentEmployeeId =
    current?.employeeId && employeeIds.has(current.employeeId) ? current.employeeId : null;
  const currentGoalId = current?.goalId && goalIds.has(current.goalId) ? current.goalId : null;
  const selectedEmployeeId = payload.selectedEmployee?.id ?? null;
  const canAdoptPayloadGoal = currentEmployeeId === null || currentEmployeeId === selectedEmployeeId;

  return {
    employeeId:
      currentEmployeeId ??
      payload.selectedEmployee?.id ??
      payload.employees.find((employee) => employee.goalCount > 0)?.id ??
      payload.employees[0]?.id ??
      null,
    goalId: currentGoalId ?? (canAdoptPayloadGoal ? payload.selectedGoal?.id ?? payload.goals[0]?.id ?? null : null)
  };
}

export function createScoreDrafts(goal: LeaderGoalDetail | null): Record<string, ScoreDraft> {
  if (!goal) {
    return {};
  }

  return Object.fromEntries(
    goal.keyResults.map((keyResult) => [
      keyResult.id,
      {
        score: keyResult.reviewScore,
        comment: keyResult.reviewComment ?? ''
      }
    ])
  );
}

export function filterWorkbenchEmployees(employees: LeaderWorkbenchResponse['employees'], keyword: string) {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) {
    return employees;
  }

  return employees.filter((employee) =>
    [employee.name, employee.sectionName ?? '', employee.reviewGroupName ?? ''].some((value) =>
      normalizeKeyword(value).includes(normalized)
    )
  );
}

export function filterWorkbenchEmployeesByProofStatus(
  employees: LeaderWorkbenchResponse['employees'],
  onlyWithProofs: boolean
) {
  if (!onlyWithProofs) {
    return employees;
  }

  return employees.filter((employee) => employee.proofCount > 0);
}

export function filterWorkbenchGoals(goals: LeaderWorkbenchResponse['goals'], keyword: string) {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) {
    return goals;
  }

  return goals.filter((goal) =>
    [goal.code, goal.name, goal.description ?? ''].some((value) => normalizeKeyword(value).includes(normalized))
  );
}

export function filterWorkbenchGoalsByProofStatus(goals: LeaderWorkbenchResponse['goals'], onlyWithProofs: boolean) {
  if (!onlyWithProofs) {
    return goals;
  }

  return goals.filter((goal) => goal.proofCount > 0);
}

export function filterWorkbenchKeyResults(keyResults: LeaderGoalDetail['keyResults'], keyword: string) {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) {
    return keyResults;
  }

  return keyResults.filter((keyResult) =>
    [keyResult.code, keyResult.name, keyResult.description ?? ''].some((value) =>
      normalizeKeyword(value).includes(normalized)
    )
  );
}

export function filterWorkbenchKeyResultsByProofStatus(
  keyResults: LeaderGoalDetail['keyResults'],
  onlyWithProofs: boolean
) {
  if (!onlyWithProofs) {
    return sortWorkbenchKeyResults(keyResults);
  }

  return sortWorkbenchKeyResults(keyResults.filter((keyResult) => keyResult.hasProofs));
}

export function sortWorkbenchKeyResults(keyResults: LeaderGoalDetail['keyResults']) {
  return [...keyResults].sort((left, right) => {
    if (left.isProofMissing !== right.isProofMissing) {
      return left.isProofMissing ? -1 : 1;
    }

    return left.code.localeCompare(right.code);
  });
}

export function buildWorkbenchFilterOptions(employees: LeaderWorkbenchResponse['employees']) {
  const allOption = { value: ALL_FILTER_VALUE, label: '\u5168\u90e8' };
  const sections = uniqueBy(
    employees
      .filter((employee) => employee.sectionId && employee.sectionName)
      .map((employee) => ({
        value: employee.sectionId as string,
        label: employee.sectionName as string
      })),
    (item) => item.value
  );

  const reviewGroups = uniqueBy(
    employees
      .filter((employee) => employee.reviewGroupId && employee.reviewGroupName)
      .map((employee) => ({
        value: employee.reviewGroupId as string,
        label: employee.reviewGroupName as string
      })),
    (item) => item.value
  );

  return {
    sections: [allOption, ...sections],
    reviewGroups: [allOption, ...reviewGroups]
  };
}

export function resolveWorkbenchQueueFilters(
  employees: LeaderWorkbenchResponse['employees'],
  filters: { sectionId?: string | null; reviewGroupId?: string | null }
) {
  const sectionId = filters.sectionId ?? null;
  const reviewGroupOptions = buildWorkbenchFilterOptions(
    filterBulkScoreEmployees(employees, {
      sectionId
    })
  ).reviewGroups;
  const reviewGroupId =
    filters.reviewGroupId && reviewGroupOptions.some((option) => option.value === filters.reviewGroupId)
      ? filters.reviewGroupId
      : null;

  return {
    sectionId,
    reviewGroupId
  };
}

export function resolveWorkbenchQueueSelection(
  employees: LeaderWorkbenchResponse['employees'],
  input: {
    sectionId?: string | null;
    reviewGroupId?: string | null;
    keyword: string;
    onlyWithProofs: boolean;
    selectedEmployeeId?: string | null;
  }
) {
  const filters = resolveWorkbenchQueueFilters(employees, input);
  const filteredEmployees = filterWorkbenchEmployees(
    filterWorkbenchEmployeesByProofStatus(
      filterBulkScoreEmployees(employees, {
        sectionId: filters.sectionId,
        reviewGroupId: filters.reviewGroupId
      }),
      input.onlyWithProofs
    ),
    input.keyword
  );
  const employeeId =
    input.selectedEmployeeId && filteredEmployees.some((employee) => employee.id === input.selectedEmployeeId)
      ? input.selectedEmployeeId
      : filteredEmployees[0]?.id ?? null;

  return {
    ...filters,
    employeeId
  };
}

export function filterBulkScoreEmployees(
  employees: LeaderWorkbenchResponse['employees'],
  filters: { sectionId?: string | null; reviewGroupId?: string | null }
) {
  return employees.filter((employee) => {
    if (filters.sectionId && employee.sectionId !== filters.sectionId) {
      return false;
    }

    if (filters.reviewGroupId && employee.reviewGroupId !== filters.reviewGroupId) {
      return false;
    }

    return true;
  });
}

export function selectAllBulkEmployeeIds(
  employees: LeaderWorkbenchResponse['employees'],
  filters: { sectionId?: string | null; reviewGroupId?: string | null }
) {
  return filterBulkScoreEmployees(employees, filters).map((employee) => employee.id);
}

export function resolveObjectiveBulkEmployeeIds(selectedEmployeeIds: string[], scorableEmployeeIds: string[]) {
  if (!scorableEmployeeIds.length) {
    return [];
  }

  const selectedScorableEmployeeIds = selectedEmployeeIds.filter((employeeId) => scorableEmployeeIds.includes(employeeId));
  return selectedScorableEmployeeIds.length === scorableEmployeeIds.length ? scorableEmployeeIds : scorableEmployeeIds;
}

export type BulkPreviewRow = {
  employeeId: string;
  employeeName: string;
  sectionName: string | null;
  reviewGroupName: string | null;
  goalId: string;
  goalCode: string;
  goalName: string;
  isTemplateGoal: boolean;
  keyResultId: string;
  keyResultCode: string;
  keyResultName: string;
  points: number;
  scoreType: 'objective' | 'subjective';
  reviewScore: number | null;
  canScore: boolean;
  proofCount: number;
  hasProofs: boolean;
  isProofMissing: boolean;
};

export type SubjectiveBulkMatrixColumn = {
  key: string;
  name: string;
  points: number;
  maxAverageScore: number;
};

export type SubjectiveBulkMatrixCell = {
  keyResultId: string;
  goalId: string;
  goalCode: string;
  goalName: string;
  keyResultCode: string;
  keyResultName: string;
  reviewScore: number | null;
  canScore: boolean;
  points: number;
};

export type SubjectiveBulkMatrixRow = {
  employeeId: string;
  employeeName: string;
  sectionName: string | null;
  reviewGroupName: string | null;
  canScore: boolean;
  cells: Record<string, SubjectiveBulkMatrixCell | null>;
};

export type SubjectiveBulkAveragePreview = SubjectiveBulkMatrixColumn & {
  averageScore: number;
  participantCount: number;
  exceeded: boolean;
};

export function buildSubjectiveBulkMatrixKey(name: string, points: number) {
  return `${name.trim()}::${points}`;
}

export function buildBulkScorePreview(
  catalog: LeaderWorkbenchResponse['bulkCatalog'],
  selection: {
    sectionId?: string | null;
    reviewGroupId?: string | null;
    employeeIds: string[];
    goalIds: string[];
    keyResultIds: string[] | null;
    excludeTemplateGoals: boolean;
    excludedTemplateGoalKeys?: string[];
    excludedTemplateKeyResultKeys?: string[];
    includedTemplateGoalKeys?: string[];
    includedTemplateKeyResultKeys?: string[];
  }
) {
  const selectedEmployeeIds = new Set(selection.employeeIds);
  const selectedGoalIds = new Set(selection.goalIds);
  const selectedKeyResultIds = new Set(selection.keyResultIds ?? []);
  const excludedTemplateGoalKeys = new Set(selection.excludedTemplateGoalKeys ?? []);
  const excludedTemplateKeyResultKeys = new Set(selection.excludedTemplateKeyResultKeys ?? []);
  const includedTemplateGoalKeys = new Set(selection.includedTemplateGoalKeys ?? []);
  const includedTemplateKeyResultKeys = new Set(selection.includedTemplateKeyResultKeys ?? []);

  const selectedEmployees = filterBulkCatalogEmployees(catalog, {
    sectionId: selection.sectionId,
    reviewGroupId: selection.reviewGroupId
  }).filter((employee) => selectedEmployeeIds.has(employee.id)).filter((employee) => employee.canScore);

  const previewRows = selectedEmployees.flatMap((employee) =>
    employee.goals
      .filter((goal) => {
        if (selection.excludeTemplateGoals && goal.isTemplateGoal) {
          return false;
        }

        if (goal.isTemplateGoal && excludedTemplateGoalKeys.has(buildBulkGoalFilterKey(goal))) {
          return false;
        }

        if (includedTemplateGoalKeys.size > 0) {
          if (!goal.isTemplateGoal) {
            return false;
          }

          if (!includedTemplateGoalKeys.has(buildBulkGoalFilterKey(goal))) {
            return false;
          }
        }

        if (selectedGoalIds.size > 0 && !selectedGoalIds.has(goal.id)) {
          return false;
        }

        return true;
      })
      .flatMap((goal) =>
        goal.keyResults
          .filter((keyResult) => {
            if (selection.keyResultIds !== null && !selectedKeyResultIds.has(keyResult.id)) {
              return false;
            }

            if (
              goal.isTemplateGoal &&
              excludedTemplateKeyResultKeys.has(buildBulkTemplateKeyResultFilterKey(goal, keyResult))
            ) {
              return false;
            }

            if (includedTemplateGoalKeys.size > 0 && includedTemplateKeyResultKeys.size > 0) {
              return includedTemplateKeyResultKeys.has(buildBulkKeyResultFilterKey(goal, keyResult));
            }

            return true;
          })
          .map((keyResult) => ({
            employeeId: employee.id,
            employeeName: employee.name,
            sectionName: employee.sectionName,
            reviewGroupName: employee.reviewGroupName,
            goalId: goal.id,
            goalCode: goal.code,
            goalName: goal.name,
            isTemplateGoal: goal.isTemplateGoal,
            keyResultId: keyResult.id,
            keyResultCode: keyResult.code,
            keyResultName: keyResult.name,
            points: keyResult.points,
            scoreType: keyResult.scoreType,
            reviewScore: keyResult.reviewScore,
            canScore: employee.canScore,
            proofCount: keyResult.proofCount,
            hasProofs: keyResult.hasProofs,
            isProofMissing: keyResult.isProofMissing
          }))
      )
  );

  const previewGoalIds = new Set(previewRows.map((entry) => entry.goalId));
  return {
    employees: selectedEmployees,
    goals: uniqueBy(
      selectedEmployees.flatMap((employee) =>
        employee.goals
          .filter((goal) => previewGoalIds.has(goal.id))
          .map((goal) => ({
            employeeId: employee.id,
            employeeName: employee.name,
            goalId: goal.id,
            goalCode: goal.code,
            goalName: goal.name,
            isTemplateGoal: goal.isTemplateGoal
          }))
      ),
      (entry) => `${entry.employeeId}:${entry.goalId}`
    ),
    keyResults: uniqueBy(previewRows, (entry) => entry.keyResultId),
    rows: previewRows,
    readonlyRows: previewRows.filter((entry) => !entry.canScore).length
  };
}

export function selectAllBulkKeyResultIds(
  catalog: LeaderWorkbenchResponse['bulkCatalog'],
  selection: {
    sectionId?: string | null;
    reviewGroupId?: string | null;
    employeeIds: string[];
    goalIds: string[];
    excludeTemplateGoals: boolean;
    excludedTemplateGoalKeys?: string[];
    excludedTemplateKeyResultKeys?: string[];
    includedTemplateGoalKeys?: string[];
    includedTemplateKeyResultKeys?: string[];
  }
) {
  const selectedEmployeeIds = new Set(selection.employeeIds);
  const selectedGoalIds = new Set(selection.goalIds);
  const excludedTemplateGoalKeys = new Set(selection.excludedTemplateGoalKeys ?? []);
  const excludedTemplateKeyResultKeys = new Set(selection.excludedTemplateKeyResultKeys ?? []);
  const includedTemplateGoalKeys = new Set(selection.includedTemplateGoalKeys ?? []);
  const includedTemplateKeyResultKeys = new Set(selection.includedTemplateKeyResultKeys ?? []);

  return uniqueBy(
    filterBulkCatalogEmployees(catalog, {
      sectionId: selection.sectionId,
      reviewGroupId: selection.reviewGroupId
    })
      .filter((employee) => selectedEmployeeIds.has(employee.id))
      .flatMap((employee) =>
        employee.goals
          .filter((goal) => !(selection.excludeTemplateGoals && goal.isTemplateGoal))
          .filter((goal) => !goal.isTemplateGoal || !excludedTemplateGoalKeys.has(buildBulkGoalFilterKey(goal)))
          .filter(
            (goal) => includedTemplateGoalKeys.size === 0 || (goal.isTemplateGoal && includedTemplateGoalKeys.has(buildBulkGoalFilterKey(goal)))
          )
          .filter((goal) => selectedGoalIds.size === 0 || selectedGoalIds.has(goal.id))
          .flatMap((goal) =>
            goal.keyResults
              .filter((keyResult) => keyResult.scoreType === 'objective')
              .filter(
                (keyResult) =>
                  !goal.isTemplateGoal ||
                  !excludedTemplateKeyResultKeys.has(buildBulkTemplateKeyResultFilterKey(goal, keyResult))
              )
              .filter(
                (keyResult) =>
                  includedTemplateGoalKeys.size === 0 ||
                  includedTemplateKeyResultKeys.size === 0 ||
                  includedTemplateKeyResultKeys.has(buildBulkKeyResultFilterKey(goal, keyResult))
              )
              .map((keyResult) => keyResult.id)
          )
      ),
    (entry) => entry
  );
}

export function isSameScoreDraftMap(
  current: Record<string, ScoreDraft>,
  next: Record<string, ScoreDraft>
) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  for (const key of currentKeys) {
    const currentDraft = current[key];
    const nextDraft = next[key];

    if (!nextDraft) {
      return false;
    }

    if (currentDraft.score !== nextDraft.score || currentDraft.comment !== nextDraft.comment) {
      return false;
    }
  }

  return true;
}

export function selectAllUnscoredBulkKeyResultIds(
  catalog: LeaderWorkbenchResponse['bulkCatalog'],
  selection: {
    sectionId?: string | null;
    reviewGroupId?: string | null;
    employeeIds: string[];
    goalIds: string[];
    excludeTemplateGoals: boolean;
    excludedTemplateGoalKeys?: string[];
    excludedTemplateKeyResultKeys?: string[];
    includedTemplateGoalKeys?: string[];
    includedTemplateKeyResultKeys?: string[];
  }
) {
  const selectedEmployeeIds = new Set(selection.employeeIds);
  const selectedGoalIds = new Set(selection.goalIds);
  const excludedTemplateGoalKeys = new Set(selection.excludedTemplateGoalKeys ?? []);
  const excludedTemplateKeyResultKeys = new Set(selection.excludedTemplateKeyResultKeys ?? []);
  const includedTemplateGoalKeys = new Set(selection.includedTemplateGoalKeys ?? []);
  const includedTemplateKeyResultKeys = new Set(selection.includedTemplateKeyResultKeys ?? []);

  return uniqueBy(
    filterBulkCatalogEmployees(catalog, {
      sectionId: selection.sectionId,
      reviewGroupId: selection.reviewGroupId
    })
      .filter((employee) => selectedEmployeeIds.has(employee.id))
      .flatMap((employee) =>
        employee.goals
          .filter((goal) => !(selection.excludeTemplateGoals && goal.isTemplateGoal))
          .filter((goal) => !goal.isTemplateGoal || !excludedTemplateGoalKeys.has(buildBulkGoalFilterKey(goal)))
          .filter(
            (goal) => includedTemplateGoalKeys.size === 0 || (goal.isTemplateGoal && includedTemplateGoalKeys.has(buildBulkGoalFilterKey(goal)))
          )
          .filter((goal) => selectedGoalIds.size === 0 || selectedGoalIds.has(goal.id))
          .flatMap((goal) =>
            goal.keyResults
              .filter((keyResult) => keyResult.reviewScore === null)
              .filter(
                (keyResult) =>
                  !goal.isTemplateGoal ||
                  !excludedTemplateKeyResultKeys.has(buildBulkTemplateKeyResultFilterKey(goal, keyResult))
              )
              .filter(
                (keyResult) =>
                  includedTemplateGoalKeys.size === 0 ||
                  includedTemplateKeyResultKeys.size === 0 ||
                  includedTemplateKeyResultKeys.has(buildBulkKeyResultFilterKey(goal, keyResult))
              )
              .map((keyResult) => keyResult.id)
          )
      ),
    (entry) => entry
  );
}

export function buildSubjectiveBulkScoreMatrix(
  catalog: LeaderWorkbenchResponse['bulkCatalog'],
  selection: {
    sectionId?: string | null;
  }
) {
  const columns = new Map<string, SubjectiveBulkMatrixColumn>();
  const rows = filterBulkCatalogEmployees(catalog, {
    sectionId: selection.sectionId,
    reviewGroupId: null
  })
    .filter((employee) => employee.canScore)
    .map<SubjectiveBulkMatrixRow>((employee) => {
      const cells = new Map<string, SubjectiveBulkMatrixCell>();

      for (const goal of employee.goals) {
        for (const keyResult of goal.keyResults) {
          if (keyResult.scoreType !== 'subjective') {
            continue;
          }

          const key = buildSubjectiveBulkMatrixKey(keyResult.name, keyResult.points);
          if (!columns.has(key)) {
            columns.set(key, {
              key,
              name: keyResult.name,
              points: keyResult.points,
              maxAverageScore: keyResult.points * 0.9
            });
          }

          if (!cells.has(key)) {
            cells.set(key, {
              keyResultId: keyResult.id,
              goalId: goal.id,
              goalCode: goal.code,
              goalName: goal.name,
              keyResultCode: keyResult.code,
              keyResultName: keyResult.name,
              reviewScore: keyResult.reviewScore,
              canScore: employee.canScore,
              points: keyResult.points
            });
          }
        }
      }

      return {
        employeeId: employee.id,
        employeeName: employee.name,
        sectionName: employee.sectionName,
        reviewGroupName: employee.reviewGroupName,
        canScore: employee.canScore,
        cells: Object.fromEntries(cells)
      };
    })
    .filter((row) => Object.keys(row.cells).length > 0);

  const orderedColumns = Array.from(columns.values()).sort((left, right) => {
    if (left.points !== right.points) {
      return right.points - left.points;
    }

    return left.name.localeCompare(right.name, 'zh-Hans-CN');
  });

  return {
    columns: orderedColumns,
    rows: rows.map((row) => ({
      ...row,
      cells: Object.fromEntries(orderedColumns.map((column) => [column.key, row.cells[column.key] ?? null]))
    }))
  };
}

export function createSubjectiveBulkScoreDrafts(rows: SubjectiveBulkMatrixRow[]): Record<string, ScoreDraft> {
  return Object.fromEntries(
    rows.flatMap((row) =>
      Object.values(row.cells)
        .filter((cell): cell is SubjectiveBulkMatrixCell => Boolean(cell))
        .map((cell) => [
          cell.keyResultId,
          {
            score: cell.reviewScore,
            comment: ''
          }
        ])
    )
  );
}

export function buildSubjectiveBulkAveragePreview(
  columns: SubjectiveBulkMatrixColumn[],
  rows: SubjectiveBulkMatrixRow[],
  drafts: Record<string, ScoreDraft>
): SubjectiveBulkAveragePreview[] {
  return columns.map((column) => {
    const cells = rows
      .map((row) => row.cells[column.key])
      .filter((cell): cell is SubjectiveBulkMatrixCell => Boolean(cell));
    const participantCount = cells.length;
    const totalScore = cells.reduce(
      (sum, cell) => sum + (drafts[cell.keyResultId]?.score ?? cell.reviewScore ?? 0),
      0
    );
    const averageScore = participantCount > 0 ? totalScore / participantCount : 0;

    return {
      ...column,
      averageScore,
      participantCount,
      exceeded: averageScore > column.maxAverageScore + 1e-6
    };
  });
}

function filterBulkCatalogEmployees(
  employees: LeaderWorkbenchResponse['bulkCatalog'],
  filters: { sectionId?: string | null; reviewGroupId?: string | null }
) {
  return employees.filter((employee) => {
    if (filters.sectionId && employee.sectionId !== filters.sectionId) {
      return false;
    }

    if (filters.reviewGroupId && employee.reviewGroupId !== filters.reviewGroupId) {
      return false;
    }

    return true;
  });
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  return Array.from(new Map(items.map((item) => [getKey(item), item])).values());
}
