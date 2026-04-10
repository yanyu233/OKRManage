import type { LeaderRankingResponse } from '../../shared/types/leader';

export function resolveRankingSelection(
  payload: LeaderRankingResponse,
  current?: { reviewGroupId?: string | null; employeeId?: string | null }
) {
  return {
    reviewGroupId: current?.reviewGroupId ?? payload.selectedReviewGroup?.id ?? payload.reviewGroups[0]?.id ?? null,
    employeeId: current?.employeeId ?? payload.selectedEmployee?.employeeId ?? payload.ranking[0]?.employeeId ?? null
  };
}

export function formatQuarterScore(score: number | null) {
  if (score === null) {
    return '-';
  }

  return score.toFixed(1);
}
