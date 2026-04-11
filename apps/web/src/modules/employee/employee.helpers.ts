import type { EmployeeOkrResponse } from '../../shared/types/employee';
import { normalizeKeyword } from '../../shared/ui/toolbar-options';

export function resolveEmployeeGoalSelection(data: EmployeeOkrResponse, goalId: string | null) {
  if (goalId && data.goals.some((goal) => goal.id === goalId)) {
    return goalId;
  }

  return data.goals[0]?.id ?? null;
}

export function formatProofSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function filterEmployeeGoals(goals: EmployeeOkrResponse['goals'], keyword: string) {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) {
    return goals;
  }

  return goals.filter((goal) =>
    [goal.code, goal.name, goal.description ?? ''].some((value) => normalizeKeyword(value).includes(normalized))
  );
}

export function buildYearOptions(startYear: number, endYear: number) {
  const from = Math.min(startYear, endYear);
  const to = Math.max(startYear, endYear);
  const years: number[] = [];

  for (let year = to; year >= from; year -= 1) {
    years.push(year);
  }

  return years;
}
