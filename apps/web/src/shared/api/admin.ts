import type { AdminOrgBootstrap, AdminOrgBootstrapInput } from '../types/admin-config';
import { apiRequest } from './http';

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
