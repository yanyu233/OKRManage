import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { loadRealisticAdminBootstrapFixture } from './support/admin-bootstrap-fixture';
import { createTestApp, loginAsSysadmin } from './support/test-app';

describe('Admin bootstrap realistic fixture', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('accepts the realistic admin bootstrap fixture snapshot', async () => {
    const agent = await loginAsSysadmin(app);
    const fixture = loadRealisticAdminBootstrapFixture();

    const response = await agent.put('/api/admin/org/bootstrap').send(fixture).expect(200);

    expect(response.body.departments).toHaveLength(fixture.departments.length);
    expect(response.body.sections).toHaveLength(fixture.sections.length);
    expect(response.body.users).toHaveLength(fixture.users.length);
    expect(response.body.goalTemplates).toHaveLength(fixture.goalTemplates.length);
    expect(response.body.goalTemplates.map((entry: { name: string }) => entry.name)).toEqual([
      '工作态度与能力',
      '目标任务综合评价'
    ]);
    expect(
      response.body.goalTemplates.find((entry: { name: string }) => entry.name === '工作态度与能力')?.keyResults
    ).toHaveLength(5);
  });
});
