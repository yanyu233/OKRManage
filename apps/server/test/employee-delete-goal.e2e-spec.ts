import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee } from './support/test-app';

describe('Employee delete goal', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await closeTestDatabase();
  });

  it('deletes a draft goal and resequences remaining goals', async () => {
    const agent = await loginAsEmployee(app);
    const firstGoal = await agent
      .post('/api/employee/goals')
      .send({
        year: 2029,
        quarter: 2,
        name: 'First draft goal',
        description: 'First draft goal for deletion',
        keyResults: [
          {
            code: 'KR1',
            name: 'First KR',
            description: null,
            points: 10
          }
        ]
      })
      .expect(201);

    await agent
      .post('/api/employee/goals')
      .send({
        year: 2029,
        quarter: 2,
        name: 'Second draft goal',
        description: 'Second draft goal for resequencing',
        keyResults: [
          {
            code: 'KR1',
            name: 'Second KR',
            description: null,
            points: 20
          }
        ]
      })
      .expect(201);

    await agent.delete(`/api/employee/goals/${firstGoal.body.id}`).expect(204);

    await agent
      .get('/api/employee/okr?year=2029&quarter=2')
      .expect(200)
      .expect(({ body }) => {
        expect(body.goals).toHaveLength(1);
        expect(body.goals[0]).toEqual(
          expect.objectContaining({
            code: 'O1',
            name: 'Second draft goal'
          })
        );
      });
  });

  it('deletes a draft key result and recalculates goal points', async () => {
    const agent = await loginAsEmployee(app);
    const createdGoal = await agent
      .post('/api/employee/goals')
      .send({
        year: 2029,
        quarter: 3,
        name: 'Draft goal with removable KRs',
        description: 'Created to verify KR deletion',
        keyResults: [
          {
            code: 'KR1',
            name: 'Keep me',
            description: null,
            points: 10
          },
          {
            code: 'KR2',
            name: 'Delete me',
            description: null,
            points: 15
          }
        ]
      })
      .expect(201);

    const detailResponse = await agent.get(`/api/employee/goals/${createdGoal.body.id}`).expect(200);
    const removableKr = detailResponse.body.keyResults.find((entry: { code: string }) => entry.code === 'KR2');

    await agent.delete(`/api/employee/key-results/${removableKr.id}`).expect(204);

    await agent
      .get(`/api/employee/goals/${createdGoal.body.id}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalPoints).toBe(10);
        expect(body.keyResults).toHaveLength(1);
        expect(body.keyResults[0]).toEqual(
          expect.objectContaining({
            code: 'KR1',
            name: 'Keep me',
            points: 10
          })
        );
      });
  });
});
