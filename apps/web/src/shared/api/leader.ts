import type {
  LeaderAnnualRankingResponse,
  BulkLeaderKrScoreInput,
  BulkLeaderKrScoreResponse,
  LeaderRankingResponse,
  LeaderWorkbenchResponse,
  UpdateLeaderKrScoreInput
} from '../types/leader';
import { apiRequest } from './http';

type WorkbenchQuery = {
  year: number;
  quarter: number;
  employeeId?: string | null;
  goalId?: string | null;
};

type RankingQuery = {
  year: number;
  quarter: number;
  reviewGroupId?: string | null;
  employeeId?: string | null;
};

type AnnualRankingQuery = {
  year: number;
  employeeId?: string | null;
};

export function getLeaderWorkbench(query: WorkbenchQuery) {
  return apiRequest<LeaderWorkbenchResponse>(`/leader/workbench${toQueryString(query)}`, {
    method: 'GET'
  });
}

export function updateLeaderKrScore(krId: string, payload: UpdateLeaderKrScoreInput) {
  return apiRequest(`/leader/key-results/${krId}/score`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function bulkLeaderKrScore(payload: BulkLeaderKrScoreInput) {
  return apiRequest<BulkLeaderKrScoreResponse>('/leader/bulk-score', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getLeaderRanking(query: RankingQuery) {
  return apiRequest<LeaderRankingResponse>(`/leader/ranking${toQueryString(query)}`, {
    method: 'GET'
  });
}

export function getLeaderAnnualRanking(query: AnnualRankingQuery) {
  return apiRequest<LeaderAnnualRankingResponse>(`/leader/annual-ranking${toQueryString(query)}`, {
    method: 'GET'
  });
}

function toQueryString(query: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    params.set(key, String(value));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}
