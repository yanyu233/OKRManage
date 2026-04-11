import type { LeaderRankingResponse } from '../../shared/types/leader';
import { normalizeKeyword } from '../../shared/ui/toolbar-options';

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

export function filterRankingEntries(ranking: LeaderRankingResponse['ranking'], keyword: string) {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) {
    return ranking;
  }

  return ranking.filter((entry) =>
    [entry.employeeName, entry.sectionName ?? ''].some((value) => normalizeKeyword(value).includes(normalized))
  );
}

export function filterRankingGoalBreakdown(
  breakdown: NonNullable<LeaderRankingResponse['selectedEmployee']>['goalBreakdown'],
  keyword: string
) {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) {
    return breakdown;
  }

  return breakdown.filter((goal) =>
    [goal.goalCode, goal.goalName, ...goal.keyResults.flatMap((keyResult) => [keyResult.code, keyResult.name])].some(
      (value) => normalizeKeyword(value).includes(normalized)
    )
  );
}
