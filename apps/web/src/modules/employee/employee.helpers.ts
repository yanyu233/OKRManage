import { ApiError } from '../../shared/api/http';
import type {
  CreateEmployeeGoalInput,
  EmployeeGoalDetail,
  EmployeeKeyResult,
  EmployeeOkrResponse,
  UpdateEmployeeGoalInput
} from '../../shared/types/employee';
import { normalizeKeyword } from '../../shared/ui/toolbar-options';

export const EMPLOYEE_QUARTER_POINT_LIMIT = 100;

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

export function getEmployeeQuarterAllocatedPoints(goals: EmployeeOkrResponse['goals']) {
  return goals.reduce((sum, goal) => sum + goal.totalPoints, 0);
}

export function getDraftGoalPoints(payload: Pick<CreateEmployeeGoalInput, 'keyResults'> | Pick<UpdateEmployeeGoalInput, 'keyResults'>) {
  return payload.keyResults.reduce((sum, keyResult) => sum + keyResult.points, 0);
}

export function isQuarterPointLimitError(error: unknown) {
  return error instanceof ApiError && error.message === 'quarter total points cannot exceed 100';
}

export function isEmployeeKeyResultActionRequired(
  keyResult: Pick<EmployeeKeyResult, 'completionState' | 'isProofMissing'>,
  options?: { suppressProofMissing?: boolean }
) {
  return (!options?.suppressProofMissing && keyResult.isProofMissing) || keyResult.completionState !== 'completed';
}

export function isEmployeeGoalActionRequired(
  goal: Pick<EmployeeOkrResponse['goals'][number], 'completedKeyResultCount' | 'keyResultCount' | 'missingProofKeyResultCount' | 'isTemplateGoal'>
) {
  return (!goal.isTemplateGoal && goal.missingProofKeyResultCount > 0) || goal.completedKeyResultCount < goal.keyResultCount;
}

export function filterEmployeeGoalKeyResults(
  keyResults: EmployeeGoalDetail['keyResults'],
  onlyActionRequired: boolean,
  options?: { suppressProofMissing?: boolean }
) {
  if (!onlyActionRequired) {
    return keyResults;
  }

  return keyResults.filter((keyResult) => isEmployeeKeyResultActionRequired(keyResult, options));
}
