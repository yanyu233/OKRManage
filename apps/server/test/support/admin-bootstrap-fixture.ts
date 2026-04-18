import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type AdminBootstrapFixture = {
  departments: Array<Record<string, unknown>>;
  sections: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
  localAccounts: Array<Record<string, unknown>>;
  roleAssignments: Array<Record<string, unknown>>;
  sectionLeaderBindings: Array<Record<string, unknown>>;
  groupLeaderBindings: Array<Record<string, unknown>>;
  reviewGroups: Array<Record<string, unknown>>;
  goalTemplates: Array<Record<string, unknown>>;
};

export function loadRealisticAdminBootstrapFixture(): AdminBootstrapFixture {
  const filePath = join(__dirname, '..', 'fixtures', 'admin-bootstrap-current-demo.fixture.json');
  return JSON.parse(readFileSync(filePath, 'utf8')) as AdminBootstrapFixture;
}
