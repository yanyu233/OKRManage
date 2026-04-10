import type { LeaderGoalDetail, LeaderWorkbenchResponse } from '../../shared/types/leader';

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
