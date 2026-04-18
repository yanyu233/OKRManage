import type {
  AdminGoalStatusControlQuery,
  AdminGoalStatusControlResponse,
  AdminGoalStatusTransitionInput,
  AdminGoalStatusTransitionResponse,
  AdminOrgBootstrap,
  AdminOrgBootstrapInput
} from '../types/admin-config';
import { apiRequest, apiRequestBlob } from './http';

export function getAdminBootstrap() {
  return apiRequest<AdminOrgBootstrap>('/admin/org/bootstrap', {
    method: 'GET'
  });
}

export function saveAdminBootstrap(payload: AdminOrgBootstrapInput) {
  return apiRequest<AdminOrgBootstrap>('/admin/org/bootstrap', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function exportAdminBootstrapExcel() {
  return apiRequestBlob('/admin/org/bootstrap/excel', {
    method: 'GET'
  });
}

export function importAdminBootstrapExcel(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return apiRequest<AdminOrgBootstrap>('/admin/org/bootstrap/excel', {
    method: 'POST',
    body: formData
  });
}

export function getAdminGoalStatusControls(query: AdminGoalStatusControlQuery) {
  return apiRequest<AdminGoalStatusControlResponse>(`/admin/goal-status-control${toQueryString(query)}`, {
    method: 'GET'
  });
}

export function transitionAdminGoalStatuses(payload: AdminGoalStatusTransitionInput) {
  return apiRequest<AdminGoalStatusTransitionResponse>('/admin/goal-status-control/transition', {
    method: 'POST',
    body: JSON.stringify(payload)
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
