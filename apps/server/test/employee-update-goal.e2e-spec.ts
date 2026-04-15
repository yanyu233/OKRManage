import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee } from './support/test-app';

describe('Employee update goal', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('updates a draft goal without dropping key result points', async () => {
    const agent = await loginAsEmployee(app);
    const createdResponse = await agent
      .post('/api/employee/goals')
      .send({
        year: 2026,
        quarter: 2,
        name: 'Draft goal for update',
        description: 'Created inside update-goal test',
        keyResults: [
          {
            code: 'KR1',
            name: 'Keep points one',
            description: 'First draft key result',
            points: 10
          },
          {
            code: 'KR2',
            name: 'Keep points two',
            description: 'Second draft key result',
            points: 20
          }
        ]
      })
      .expect(201);

    const goalId = createdResponse.body.id as string;
    const detailResponse = await agent.get(`/api/employee/goals/${goalId}`).expect(200);

    const payload = {
      name: `${detailResponse.body.name} 调整`,
      description: detailResponse.body.description,
      keyResults: detailResponse.body.keyResults.map((keyResult: any) => ({
        id: keyResult.id,
        code: keyResult.code,
        name: keyResult.name,
        description: keyResult.description,
        points: keyResult.points,
        scoreType: keyResult.scoreType
      }))
    };

    const updateResponse = await agent.put(`/api/employee/goals/${goalId}`).send(payload).expect(200);

    expect(updateResponse.body).toEqual(
      expect.objectContaining({
        id: goalId,
        name: `${detailResponse.body.name} 调整`,
        totalPoints: detailResponse.body.totalPoints
      })
    );
    expect(updateResponse.body.keyResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: detailResponse.body.keyResults[0].code,
          points: detailResponse.body.keyResults[0].points
        })
      ])
    );
  });

  it('rejects updates when quarter total points would exceed 100', async () => {
    const agent = await loginAsEmployee(app);
    const firstGoal = await agent
      .post('/api/employee/goals')
      .send({
        year: 2027,
        quarter: 1,
        name: 'First draft goal',
        description: 'Created for quarter-budget validation',
        keyResults: [
          {
            code: 'KR1',
            name: 'First draft result',
            description: null,
            points: 40
          }
        ]
      })
      .expect(201);

    await agent
      .post('/api/employee/goals')
      .send({
        year: 2027,
        quarter: 1,
        name: 'Second draft goal',
        description: 'Keeps quarter budget near the limit',
        keyResults: [
          {
            code: 'KR1',
            name: 'Second draft result',
            description: null,
            points: 50
          }
        ]
      })
      .expect(201);

    const goalId = firstGoal.body.id as string;
    const detailResponse = await agent.get(`/api/employee/goals/${goalId}`).expect(200);

    await agent
      .put(`/api/employee/goals/${goalId}`)
      .send({
        name: detailResponse.body.name,
        description: detailResponse.body.description,
        keyResults: detailResponse.body.keyResults.map((keyResult: any, index: number) => ({
          id: keyResult.id,
          code: keyResult.code,
          name: keyResult.name,
          description: keyResult.description,
          points: index === 0 ? 60 : keyResult.points,
          scoreType: keyResult.scoreType
        }))
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('quarter total points cannot exceed 100');
      });
  });
});
