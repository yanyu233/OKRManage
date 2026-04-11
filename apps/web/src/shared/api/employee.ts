import type { EmployeeGoalDetail, EmployeeOkrResponse, EmployeeProof, UpdateKrCompletionInput } from '../types/employee';
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
