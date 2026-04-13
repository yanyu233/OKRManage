import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee, loginAsSectionLeader, loginAsSysadmin } from './support/test-app';

describe('Employee goal status workflow', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('supports draft edit, admin confirmation, submit for review, and completed proof uploads', async () => {
    const employee = await loginAsEmployee(app);

    const created = await employee
      .post('/api/employee/goals')
      .send({
        year: 2026,
        quarter: 1,
        name: 'Status Flow Goal',
        description: 'Initial draft goal',
        keyResults: [
          {
            code: 'KR1',
            name: 'Finish objective one',
            description: null,
            points: 10
          },
          {
            code: 'KR2',
            name: 'Finish objective two',
            description: null,
            points: 20
          }
        ]
      })
      .expect(201);

    const goalId = created.body.id as string;
    const ownerId = created.body.owner.id as string;

    await employee
      .put(`/api/employee/goals/${goalId}`)
      .send({
        name: 'Status Flow Goal Updated',
        description: 'Draft edit is allowed',
        keyResults: [
          {
            code: 'KR1',
            name: 'Finish objective one',
            description: 'Updated in draft',
            points: 10,
            scoreType: 'objective'
          },
          {
            code: 'KR2',
            name: 'Finish objective two',
            description: null,
            points: 20,
            scoreType: 'objective'
          }
        ]
      })
      .expect(200);

    const sysadmin = await loginAsSysadmin(app);
    await sysadmin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: 2026,
        quarter: 1,
        userId: ownerId,
        targetStatus: 'confirmed'
      })
      .expect(200);

    const confirmedDetail = await employee.get(`/api/employee/goals/${goalId}`).expect(200);
    expect(confirmedDetail.body.status).toBe('confirmed');

    await employee
      .put(`/api/employee/goals/${goalId}`)
      .send({
        name: 'Should fail once confirmed',
        description: 'No edit after confirm',
        keyResults: confirmedDetail.body.keyResults.map((keyResult: any) => ({
          code: keyResult.code,
          name: keyResult.name,
          description: keyResult.description,
          points: keyResult.points,
          scoreType: keyResult.scoreType
        }))
      })
      .expect(400);

    await employee
      .post(`/api/employee/key-results/${confirmedDetail.body.keyResults[0].id}/proofs`)
      .field('note', 'confirmed upload still allowed')
      .attach('file', Buffer.from('confirmed-proof', 'utf8'), 'confirmed-proof.txt')
      .expect(201);

    const leader = await loginAsSectionLeader(app);
    await leader
      .put(`/api/leader/key-results/${confirmedDetail.body.keyResults[0].id}/score`)
      .send({
        score: 10,
        comment: 'Should be blocked before review submission'
      })
      .expect(400);

    for (const keyResult of confirmedDetail.body.keyResults) {
      await employee
        .put(`/api/employee/key-results/${keyResult.id}/completion`)
        .send({
          completionState: 'completed'
        })
        .expect(200);
    }

    await employee.post(`/api/employee/goals/${goalId}/submit-review`).expect(200);

    const pendingReviewDetail = await employee.get(`/api/employee/goals/${goalId}`).expect(200);
    expect(pendingReviewDetail.body.status).toBe('pending-review');

    await employee
      .put(`/api/employee/key-results/${pendingReviewDetail.body.keyResults[0].id}/completion`)
      .send({
        completionState: 'incomplete'
      })
      .expect(400);

    await employee
      .post(`/api/employee/key-results/${pendingReviewDetail.body.keyResults[0].id}/proofs`)
      .field('note', 'pending review upload still allowed')
      .attach('file', Buffer.from('pending-review-proof', 'utf8'), 'pending-review-proof.txt')
      .expect(201);

    for (const keyResult of pendingReviewDetail.body.keyResults) {
      await leader
        .put(`/api/leader/key-results/${keyResult.id}/score`)
        .send({
          score: keyResult.points,
          comment: 'Full score after review'
        })
        .expect(200);
    }

    const completedDetail = await employee.get(`/api/employee/goals/${goalId}`).expect(200);
    expect(completedDetail.body.status).toBe('completed');

    await employee
      .put(`/api/employee/key-results/${completedDetail.body.keyResults[0].id}/completion`)
      .send({
        completionState: 'incomplete'
      })
      .expect(400);

    await employee
      .post(`/api/employee/key-results/${completedDetail.body.keyResults[0].id}/proofs`)
      .field('note', 'completed upload still allowed')
      .attach('file', Buffer.from('completed-proof', 'utf8'), 'completed-proof.txt')
      .expect(201);
  });

  it('rejects submit-for-review until every key result is marked completed', async () => {
    const employee = await loginAsEmployee(app);
    const created = await employee
      .post('/api/employee/goals')
      .send({
        year: 2026,
        quarter: 1,
        name: 'Incomplete Review Gate',
        description: 'Must complete all KR first',
        keyResults: [
          {
            code: 'KR1',
            name: 'Only one KR done',
            description: null,
            points: 15
          },
          {
            code: 'KR2',
            name: 'Still incomplete',
            description: null,
            points: 15
          }
        ]
      })
      .expect(201);

    const sysadmin = await loginAsSysadmin(app);
    await sysadmin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: 2026,
        quarter: 1,
        userId: created.body.owner.id,
        targetStatus: 'confirmed'
      })
      .expect(200);

    await employee
      .put(`/api/employee/key-results/${created.body.keyResults[0].id}/completion`)
      .send({
        completionState: 'completed'
      })
      .expect(200);

    await employee.post(`/api/employee/goals/${created.body.id}/submit-review`).expect(400);
  });
});
