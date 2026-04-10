import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSysadmin } from './support/test-app';

describe('Admin org bootstrap save', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('saves an organization snapshot and returns it from bootstrap', async () => {
    const agent = await loginAsSysadmin(app);
    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);

    await agent
      .put('/api/admin/org/bootstrap')
      .send({
        ...bootstrap.body,
        departments: [
          ...bootstrap.body.departments,
          {
            id: 'dept-new',
            name: 'New Department',
            isActive: true
          }
        ]
      })
      .expect(200);

    const refreshed = await agent.get('/api/admin/org/bootstrap').expect(200);
    expect(refreshed.body.departments.some((entry: { name: string }) => entry.name === 'New Department')).toBe(true);
  });
});
