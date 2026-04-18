import { describe, expect, it } from 'vitest';
import { defaultPathForRole, resolvePostAuthPath } from '../src/modules/layout/routing';
import type { SessionUser } from '../src/shared/types/session';

describe('session routing shell', () => {
  it('routes system-admin users to the admin org page by default', () => {
    expect(defaultPathForRole('system-admin')).toBe('/admin/org');
  });

  it('routes leader users to the workbench by default', () => {
    expect(defaultPathForRole('section-leader')).toBe('/leader/workbench');
    expect(defaultPathForRole('group-leader')).toBe('/leader/workbench');
  });

  it('routes employees to the OKR list by default', () => {
    expect(defaultPathForRole('employee')).toBe('/employee/okr');
  });

  it('keeps an allowed returnTo path after login', () => {
    expect(resolvePostAuthPath(buildUser('group-leader'), '/leader/ranking')).toBe('/leader/ranking');
    expect(resolvePostAuthPath(buildUser('employee'), '/employee/okr')).toBe('/employee/okr');
  });

  it('falls back to the role home when returnTo belongs to another role', () => {
    expect(resolvePostAuthPath(buildUser('employee'), '/leader/workbench')).toBe('/employee/okr');
    expect(resolvePostAuthPath(buildUser('group-leader'), '/admin/org')).toBe('/leader/workbench');
  });
});

function buildUser(activeRole: SessionUser['activeRole']): SessionUser {
  return {
    id: 'user-1',
    name: 'Test User',
    loginName: 'test.user',
    role: activeRole,
    activeRole,
    roles: [{ role: activeRole, isPrimary: true }]
  };
}
