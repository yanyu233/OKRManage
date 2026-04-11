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
        name: '张晨',
        goalCount: 2,
        keyResultCount: 6
      })
    );
    expect(response.body.goals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'O1',
          name: '张晨 2026 年一季度 OKR'
        }),
        expect.objectContaining({
          code: 'O4',
          name: '张晨 知识库沉淀专项'
        })
      ])
    );
  });
});
