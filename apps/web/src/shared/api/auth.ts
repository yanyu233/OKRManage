import type { SessionResponse } from '../types/session';
import { apiRequest } from './http';

export type ManualLoginInput = {
  loginName: string;
  password: string;
};

export function getCurrentSession() {
  return apiRequest<SessionResponse>('/me', {
    method: 'GET'
  });
}

export function manualLogin(payload: ManualLoginInput) {
  return apiRequest<{ ok: true; user: SessionResponse['user'] }>('/auth/manual-login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function logout() {
  return apiRequest<{ ok: true }>('/logout', {
    method: 'POST'
  });
}
