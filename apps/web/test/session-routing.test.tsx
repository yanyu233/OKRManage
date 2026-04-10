import { describe, expect, it } from 'vitest';
import { defaultPathForRole } from '../src/modules/layout/routing';

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
});
