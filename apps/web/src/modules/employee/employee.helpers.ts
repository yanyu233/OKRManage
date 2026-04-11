import type { EmployeeOkrResponse } from '../../shared/types/employee';

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
