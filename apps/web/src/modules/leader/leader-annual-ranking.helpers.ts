import type { LeaderAnnualRankingEntry, LeaderAnnualRankingResponse } from '../../shared/types/leader';

export function resolveAnnualRankingSelection(
  payload: LeaderAnnualRankingResponse,
  current?: { employeeId?: string | null }
) {
  const nextEmployeeId =
    (current?.employeeId ? payload.ranking.find((entry) => entry.employeeId === current.employeeId)?.employeeId : null) ??
    payload.selectedEmployee?.employeeId ??
    payload.ranking[0]?.employeeId ??
    null;

  return {
    employeeId: nextEmployeeId
  };
}

export function formatAnnualScore(score: number | null) {
  return score === null ? '-' : score.toFixed(1);
}

export function filterAnnualRankingEntries(entries: LeaderAnnualRankingEntry[], keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return entries;
  }

  return entries.filter((entry) =>
    [entry.employeeName, entry.sectionName ?? '', entry.reviewGroupName ?? ''].some((value) =>
      value.toLowerCase().includes(normalized)
    )
  );
}
