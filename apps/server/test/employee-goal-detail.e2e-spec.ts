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

  it('returns goal detail and persists completion toggles for a draft goal', async () => {
    const agent = await loginAsEmployee(app);
    const created = await agent
      .post('/api/employee/goals')
      .send({
        year: 2028,
        quarter: 4,
        name: 'Draft goal detail',
        description: 'Created for goal detail verification',
        keyResults: [
          {
            code: 'KR1',
            name: 'Draft KR 1',
            description: 'Can toggle completion in draft',
            points: 10
          }
        ]
      })
      .expect(201);

    const goalId = created.body.id as string;
    const detail = await agent.get(`/api/employee/goals/${goalId}`).expect(200);
    const keyResult = detail.body.keyResults.find((entry: { code: string }) => entry.code === 'KR1');

    expect(detail.body).toEqual(
      expect.objectContaining({
        code: 'O1',
        name: 'Draft goal detail'
      })
    );

    await agent
      .post(`/api/employee/key-results/${keyResult.id}/proofs`)
      .attach('file', Buffer.from('goal-detail-proof', 'utf8'), 'goal-detail-proof.txt')
      .expect(201);

    const refreshed = await agent.get(`/api/employee/goals/${goalId}`).expect(200);
    const refreshedKeyResult = refreshed.body.keyResults.find((entry: { id: string }) => entry.id === keyResult.id);

    expect(refreshedKeyResult.completionState).toBe('completed');
  });
});
