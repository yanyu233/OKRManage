import type { LeaderGoalDetail, LeaderWorkbenchResponse } from '../../shared/types/leader';
import { normalizeKeyword } from '../../shared/ui/toolbar-options';

export const ALL_FILTER_VALUE = '__all__';

export type ScoreDraft = {
  score: number | null;
  comment: string;
};

export function resolveWorkbenchSelection(
  payload: LeaderWorkbenchResponse,
  current?: { employeeId?: string | null; goalId?: string | null }
) {
  return {
    employeeId: current?.employeeId ?? payload.selectedEmployee?.id ?? payload.employees[0]?.id ?? null,
    goalId: current?.goalId ?? payload.selectedGoal?.id ?? payload.goals[0]?.id ?? null
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

export function buildBulkScorePreview(
  catalog: LeaderWorkbenchResponse['bulkCatalog'],
  selection: {
    sectionId?: string | null;
    reviewGroupId?: string | null;
    employeeIds: string[];
    goalIds: string[];
    keyResultIds: string[] | null;
    excludeTemplateGoals: boolean;
  }
) {
  const selectedEmployeeIds = new Set(selection.employeeIds);
  const selectedGoalIds = new Set(selection.goalIds);
  const selectedKeyResultIds = new Set(selection.keyResultIds ?? []);

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

        if (selectedGoalIds.size > 0 && !selectedGoalIds.has(goal.id)) {
          return false;
        }

        return true;
      })
      .flatMap((goal) =>
        goal.keyResults
          .filter((keyResult) => selection.keyResultIds === null || selectedKeyResultIds.has(keyResult.id))
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
  }
) {
  const selectedEmployeeIds = new Set(selection.employeeIds);
  const selectedGoalIds = new Set(selection.goalIds);

  return uniqueBy(
    filterBulkCatalogEmployees(catalog, {
      sectionId: selection.sectionId,
      reviewGroupId: selection.reviewGroupId
    })
      .filter((employee) => selectedEmployeeIds.has(employee.id))
      .flatMap((employee) =>
        employee.goals
          .filter((goal) => !(selection.excludeTemplateGoals && goal.isTemplateGoal))
          .filter((goal) => selectedGoalIds.size === 0 || selectedGoalIds.has(goal.id))
          .flatMap((goal) =>
            goal.keyResults
              .filter((keyResult) => keyResult.scoreType === 'objective')
              .map((keyResult) => keyResult.id)
          )
      ),
    (entry) => entry
  );
}

export function selectAllUnscoredBulkKeyResultIds(
  catalog: LeaderWorkbenchResponse['bulkCatalog'],
  selection: {
    sectionId?: string | null;
    reviewGroupId?: string | null;
    employeeIds: string[];
    goalIds: string[];
    excludeTemplateGoals: boolean;
  }
) {
  const selectedEmployeeIds = new Set(selection.employeeIds);
  const selectedGoalIds = new Set(selection.goalIds);

  return uniqueBy(
    filterBulkCatalogEmployees(catalog, {
      sectionId: selection.sectionId,
      reviewGroupId: selection.reviewGroupId
    })
      .filter((employee) => selectedEmployeeIds.has(employee.id))
      .flatMap((employee) =>
        employee.goals
          .filter((goal) => !(selection.excludeTemplateGoals && goal.isTemplateGoal))
          .filter((goal) => selectedGoalIds.size === 0 || selectedGoalIds.has(goal.id))
          .flatMap((goal) =>
            goal.keyResults
              .filter((keyResult) => keyResult.reviewScore === null)
              .map((keyResult) => keyResult.id)
          )
      ),
    (entry) => entry
  );
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
