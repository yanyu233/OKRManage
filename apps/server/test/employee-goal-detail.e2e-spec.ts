import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee } from './support/test-app';

describe('Employee goal detail', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('returns goal detail and persists completion toggles', async () => {
    const agent = await loginAsEmployee(app);
    const listResponse = await agent.get('/api/employee/okr?year=2026&quarter=1').expect(200);
    const goalId = listResponse.body.goals[0].id as string;

    const detail = await agent.get(`/api/employee/goals/${goalId}`).expect(200);
    const keyResult = detail.body.keyResults.find((entry: { code: string }) => entry.code === 'KR1');

    expect(detail.body).toEqual(
      expect.objectContaining({
        code: 'O1',
        name: '\u5f20\u6668 2026 \u5e74\u4e00\u5b63\u5ea6 OKR'
      })
    );

    await agent
      .put(`/api/employee/key-results/${keyResult.id}/completion`)
      .send({
        completionState: 'completed'
      })
      .expect(200);

    const refreshed = await agent.get(`/api/employee/goals/${goalId}`).expect(200);
    const refreshedKeyResult = refreshed.body.keyResults.find((entry: { id: string }) => entry.id === keyResult.id);

    expect(refreshedKeyResult.completionState).toBe('completed');
  });
});
