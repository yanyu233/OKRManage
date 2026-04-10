import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSysadmin } from './support/test-app';

describe('Admin bootstrap', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('returns review groups for system admins', async () => {
    const agent = await loginAsSysadmin(app);
    const response = await agent.get('/api/admin/org/bootstrap').expect(200);

    expect(response.body.reviewGroups).toEqual(expect.any(Array));
  });
});
