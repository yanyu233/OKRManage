import type {
  CreateEmployeeGoalInput,
  EmployeeGoalDetail,
  EmployeeGoalTemplateResponse,
  EmployeeOkrResponse,
  EmployeeProof,
  ImportEmployeeGoalTemplatesInput,
  ImportEmployeeGoalTemplatesResponse,
  UpdateEmployeeGoalInput,
  UpdateKrCompletionInput
} from '../types/employee';
import type { ProofArchiveManifest, ProofPreviewMeta } from '../types/proof-preview';
import { apiRequest } from './http';

type EmployeeQuarterQuery = {
  year: number;
  quarter: number;
};

export function getEmployeeOkr(query: EmployeeQuarterQuery) {
  return apiRequest<EmployeeOkrResponse>(`/employee/okr${toQueryString(query)}`, {
    method: 'GET'
  });
}

export function getEmployeeGoalDetail(goalId: string) {
  return apiRequest<EmployeeGoalDetail>(`/employee/goals/${goalId}`, {
    method: 'GET'
  });
}

export function getEmployeeGoalTemplates(query: EmployeeQuarterQuery) {
  return apiRequest<EmployeeGoalTemplateResponse>(`/employee/goal-templates${toQueryString(query)}`, {
    method: 'GET'
  });
}

export function importEmployeeGoalTemplates(payload: ImportEmployeeGoalTemplatesInput) {
  return apiRequest<ImportEmployeeGoalTemplatesResponse>('/employee/goal-templates/import', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function createEmployeeGoal(payload: CreateEmployeeGoalInput) {
  return apiRequest<EmployeeGoalDetail & { owner: { id: string; name: string } }>('/employee/goals', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateEmployeeGoal(goalId: string, payload: UpdateEmployeeGoalInput) {
  return apiRequest<EmployeeGoalDetail>(`/employee/goals/${goalId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function submitEmployeeGoalReview(goalId: string) {
  return apiRequest<EmployeeGoalDetail>(`/employee/goals/${goalId}/submit-review`, {
    method: 'POST'
  });
}

export function updateEmployeeKrCompletion(krId: string, payload: UpdateKrCompletionInput) {
  return apiRequest(`/employee/key-results/${krId}/completion`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function uploadEmployeeProof(krId: string, file: File, note?: string) {
  const formData = new FormData();
  formData.append('file', file);

  if (note && note.trim().length > 0) {
    formData.append('note', note.trim());
  }

  return apiRequest<EmployeeProof>(`/employee/key-results/${krId}/proofs`, {
    method: 'POST',
    body: formData
  });
}

export function getProofArchiveManifest(proofId: string) {
  return apiRequest<ProofArchiveManifest>(`/employee/proofs/${proofId}/archive`, {
    method: 'GET'
  });
}

export function getProofPreviewMeta(proofId: string, entryPath?: string | null) {
  return apiRequest<ProofPreviewMeta>(`/employee/proofs/${proofId}/preview-meta${toQueryString({ entryPath })}`, {
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
