import type { SessionResponse, SessionUser, UserRole } from '../types/session';
import { apiRequest, resolveApiUrl } from './http';

export type ManualLoginInput = {
  loginName: string;
  password: string;
};

export type AuthStartAction = 'session' | 'manual-login' | 'wecom';

export type AuthStartResponse = {
  action: AuthStartAction;
  redirectTo: string;
};

export function getCurrentSession() {
  return apiRequest<SessionResponse>('/me', {
    method: 'GET'
  });
}

export function authStart(returnTo?: string | null) {
  const search = new URLSearchParams();
  if (returnTo) {
    search.set('returnTo', returnTo);
  }

  const suffix = search.toString();
  return apiRequest<AuthStartResponse>(suffix ? `/auth/start?${suffix}` : '/auth/start', {
    method: 'GET'
  });
}

export function manualLogin(payload: ManualLoginInput) {
  return apiRequest<{ ok: true; user: SessionResponse['user'] }>('/auth/manual-login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function switchActiveRole(role: UserRole) {
  return apiRequest<{ ok: true; user: SessionUser }>('/auth/active-role', {
    method: 'POST',
    body: JSON.stringify({ role })
  });
}

export function logout() {
  return apiRequest<{ ok: true }>('/logout', {
    method: 'POST'
  });
}

export function redirectToWecom(redirectTo: string) {
  window.location.assign(resolveApiUrl(redirectTo));
}
