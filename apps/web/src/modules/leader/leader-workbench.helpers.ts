import type { LeaderGoalDetail, LeaderWorkbenchResponse } from '../../shared/types/leader';
import { normalizeKeyword } from '../../shared/ui/toolbar-options';

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

export function filterWorkbenchGoals(goals: LeaderWorkbenchResponse['goals'], keyword: string) {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) {
    return goals;
  }

  return goals.filter((goal) =>
    [goal.code, goal.name, goal.description ?? ''].some((value) => normalizeKeyword(value).includes(normalized))
  );
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

export function buildWorkbenchFilterOptions(employees: LeaderWorkbenchResponse['employees']) {
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
    sections,
    reviewGroups
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

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  return Array.from(new Map(items.map((item) => [getKey(item), item])).values());
}
