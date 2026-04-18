import type {
  AllOkrResponse,
  LeaderAnnualRankingResponse,
  BulkLeaderKrScoreInput,
  BulkLeaderKrScoreResponse,
  LeaderKnowledgeBaseResponse,
  LeaderKnowledgeEntry,
  LeaderProof,
  LeaderRankingResponse,
  LeaderWorkbenchResponse,
  UpdateLeaderProofKnowledgeInput,
  UpdateLeaderKrScoreInput
} from '../types/leader';
import { apiRequest, apiRequestBlob } from './http';

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

type AnnualPublicNoticeQuery = {
  year: number;
  sectionId?: string | null;
  reviewGroupId?: string | null;
};

export function getLeaderWorkbench(query: WorkbenchQuery) {
  return apiRequest<LeaderWorkbenchResponse>(`/leader/workbench${toQueryString(query)}`, {
    method: 'GET'
  });
}

export function getLeaderAllOkr(query: Pick<WorkbenchQuery, 'year' | 'quarter'>) {
  return apiRequest<AllOkrResponse>(`/leader/all-okr${toQueryString(query)}`, {
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

export function updateLeaderProofKnowledge(proofId: string, payload: UpdateLeaderProofKnowledgeInput) {
  return apiRequest<LeaderProof>(`/leader/proofs/${proofId}/knowledge`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function getLeaderKnowledgeBase() {
  return apiRequest<LeaderKnowledgeBaseResponse>('/leader/knowledge-base', {
    method: 'GET'
  });
}

export function updateLeaderKnowledgeProof(proofId: string, payload: FormData) {
  return apiRequest<LeaderKnowledgeEntry>(`/leader/knowledge-base/${proofId}`, {
    method: 'PUT',
    body: payload
  });
}

export function uploadLeaderManualKnowledgeAsset(payload: FormData) {
  return apiRequest<LeaderKnowledgeEntry>('/leader/knowledge-base/manual-assets', {
    method: 'POST',
    body: payload
  });
}

export function updateLeaderManualKnowledgeAsset(assetId: string, payload: FormData) {
  return apiRequest<LeaderKnowledgeEntry>(`/leader/knowledge-base/manual-assets/${assetId}`, {
    method: 'PUT',
    body: payload
  });
}

export function downloadLeaderKnowledgeBase(proofIds: string[]) {
  return apiRequestBlob('/leader/knowledge-base/download', {
    method: 'POST',
    body: JSON.stringify({ proofIds })
  });
}

export function getLeaderRanking(query: RankingQuery) {
  return apiRequest<LeaderRankingResponse>(`/leader/ranking${toQueryString(query)}`, {
    method: 'GET'
  });
}

export function downloadLeaderRankingPublicNotice(query: RankingQuery) {
  return apiRequestBlob(`/leader/ranking/public-notice${toQueryString(query)}`, {
    method: 'GET'
  });
}

export function getLeaderAnnualRanking(query: AnnualRankingQuery) {
  return apiRequest<LeaderAnnualRankingResponse>(`/leader/annual-ranking${toQueryString(query)}`, {
    method: 'GET'
  });
}

export function downloadLeaderAnnualRankingPublicNotice(query: AnnualPublicNoticeQuery) {
  return apiRequestBlob(`/leader/annual-ranking/public-notice${toQueryString(query)}`, {
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
