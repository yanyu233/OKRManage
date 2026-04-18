import type { LeaderAnnualRankingEntry, LeaderAnnualRankingResponse } from '../../shared/types/leader';
import { normalizeKeyword } from '../../shared/ui/toolbar-options';

export const ALL_ANNUAL_FILTER_VALUE = '__all__';

type AnnualRankingFilters = {
  sectionId?: string | null;
  reviewGroupId?: string | null;
};

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

export function buildAnnualRankingFilterOptions(
  entries: LeaderAnnualRankingEntry[],
  sectionId?: string | null
) {
  const allOption = { value: ALL_ANNUAL_FILTER_VALUE, label: '全部' };
  const sections = uniqueBy(
    entries
      .filter((entry) => entry.sectionId && entry.sectionName)
      .map((entry) => ({
        value: entry.sectionId as string,
        label: entry.sectionName as string
      })),
    (entry) => entry.value
  ).sort(compareFilterOption);

  const reviewGroups = uniqueBy(
    entries
      .filter((entry) => (!sectionId || entry.sectionId === sectionId) && entry.reviewGroupId && entry.reviewGroupName)
      .map((entry) => ({
        value: entry.reviewGroupId as string,
        label: entry.reviewGroupName as string
      })),
    (entry) => entry.value
  ).sort(compareFilterOption);

  return {
    sections: [allOption, ...sections],
    reviewGroups: [allOption, ...reviewGroups]
  };
}

export function filterAnnualRankingEntries(
  entries: LeaderAnnualRankingEntry[],
  keyword: string,
  filters: AnnualRankingFilters = {}
) {
  const normalized = normalizeKeyword(keyword);

  return entries.filter((entry) => {
    if (filters.sectionId && entry.sectionId !== filters.sectionId) {
      return false;
    }

    if (filters.reviewGroupId && entry.reviewGroupId !== filters.reviewGroupId) {
      return false;
    }

    if (!normalized) {
      return true;
    }

    return [entry.employeeName, entry.sectionName ?? '', entry.reviewGroupName ?? ''].some((value) =>
      normalizeKeyword(value).includes(normalized)
    );
  });
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  return Array.from(new Map(items.map((item) => [getKey(item), item])).values());
}

function compareFilterOption(left: { label: string }, right: { label: string }) {
  return left.label.localeCompare(right.label, 'zh-CN');
}
