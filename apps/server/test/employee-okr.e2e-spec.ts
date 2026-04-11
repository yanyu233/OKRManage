import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee } from './support/test-app';

describe('Employee OKR list', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('returns the signed-in employee quarter summary and goals', async () => {
    const agent = await loginAsEmployee(app);

    const response = await agent.get('/api/employee/okr?year=2026&quarter=1').expect(200);

    expect(response.body.employee).toEqual(
      expect.objectContaining({
        name: 'Zhang Chen',
        goalCount: 2,
        keyResultCount: 6
      })
    );
    expect(response.body.goals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'O1',
          name: 'Zhang Chen 2026 Q1 OKR'
        }),
        expect.objectContaining({
          code: 'O4',
          name: 'Zhang Chen Knowledge Program'
        })
      ])
    );
  });
});
