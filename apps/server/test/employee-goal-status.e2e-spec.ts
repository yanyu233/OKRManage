import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee, loginAsSectionLeader, loginAsSysadmin } from './support/test-app';

describe('Employee goal status workflow', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await prisma.$disconnect();
    await closeTestDatabase();
  });

  it('supports automatic review transition, proof-driven completion, and leader scoring without manual submit', async () => {
    const employee = await loginAsEmployee(app);
    const reviewPeriod = getPreviousQuarterPeriod();

    const created = await employee
      .post('/api/employee/goals')
      .send({
        year: reviewPeriod.year,
        quarter: reviewPeriod.quarter,
        name: 'Status Flow Goal',
        description: 'Initial draft goal',
        keyResults: [
          {
            code: 'KR1',
            name: 'Finish objective one',
            description: null,
            points: 5
          },
          {
            code: 'KR2',
            name: 'Finish objective two',
            description: null,
            points: 5
          }
        ]
      })
      .expect(201);

    const goalId = created.body.id as string;
    const ownerId = created.body.owner.id as string;
    const createdKeyResults = await prisma.keyResult.findMany({
      where: { goalId },
      orderBy: { code: 'asc' },
      select: { id: true }
    });
    const firstKeyResultId = createdKeyResults[0]?.id as string;
    const secondKeyResultId = createdKeyResults[1]?.id as string;

    expect(firstKeyResultId).toEqual(expect.any(String));
    expect(secondKeyResultId).toEqual(expect.any(String));

    await employee
      .put(`/api/employee/goals/${goalId}`)
      .send({
        name: 'Status Flow Goal Updated',
        description: 'Draft edit is allowed',
        keyResults: [
          {
            id: firstKeyResultId,
            code: 'KR1',
            name: 'Finish objective one',
            description: 'Updated in draft',
            points: 5,
            scoreType: 'objective'
          },
          {
            id: secondKeyResultId,
            code: 'KR2',
            name: 'Finish objective two',
            description: null,
            points: 5,
            scoreType: 'objective'
          }
        ]
      })
      .expect(200);

    const sysadmin = await loginAsSysadmin(app);
    await sysadmin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: reviewPeriod.year,
        quarter: reviewPeriod.quarter,
        userId: ownerId,
        targetStatus: 'confirmed'
      })
      .expect(200);

    await employee
      .put(`/api/employee/goals/${goalId}`)
      .send({
        name: 'Should fail once confirmed',
        description: 'No edit after confirm',
        keyResults: [
          {
            code: 'KR1',
            name: 'Finish objective one',
            description: 'Updated in draft',
            points: 5,
            scoreType: 'objective'
          },
          {
            code: 'KR2',
            name: 'Finish objective two',
            description: null,
            points: 5,
            scoreType: 'objective'
          }
        ]
      })
      .expect(400);

    await employee
      .put(`/api/employee/key-results/${firstKeyResultId}/completion`)
      .send({
        completionState: 'completed'
      })
      .expect(400);

    await employee
      .post(`/api/employee/key-results/${firstKeyResultId}/proofs`)
      .field('note', 'confirmed upload still allowed')
      .attach('file', Buffer.from('confirmed-proof', 'utf8'), 'confirmed-proof.txt')
      .expect(201);

    await employee
      .put(`/api/employee/key-results/${firstKeyResultId}/completion`)
      .send({
        completionState: 'incomplete'
      })
      .expect(200);

    await employee
      .put(`/api/employee/key-results/${firstKeyResultId}/completion`)
      .send({
        completionState: 'completed'
      })
      .expect(200);

    const leader = await loginAsSectionLeader(app);
    await leader
      .put(`/api/leader/key-results/${firstKeyResultId}/score`)
      .send({
        score: 10,
        comment: 'Should be blocked before auto review transition'
      })
      .expect(400);

    const pendingReviewDetail = await employee.get(`/api/employee/goals/${goalId}`).expect(200);
    expect(pendingReviewDetail.body.status).toBe('pending-review');
    expect(pendingReviewDetail.body.missingProofKeyResultCount).toBe(1);
    expect(
      pendingReviewDetail.body.keyResults.find((keyResult: { id: string }) => keyResult.id === firstKeyResultId)
    ).toEqual(
      expect.objectContaining({
        completionState: 'completed',
        hasProofs: true,
        isProofMissing: false
      })
    );
    expect(
      pendingReviewDetail.body.keyResults.find((keyResult: { id: string }) => keyResult.id === secondKeyResultId)
    ).toEqual(
      expect.objectContaining({
        completionState: 'incomplete',
        hasProofs: false,
        isProofMissing: true
      })
    );

    await employee
      .put(`/api/employee/key-results/${firstKeyResultId}/completion`)
      .send({
        completionState: 'incomplete'
      })
      .expect(400);

    for (const keyResult of pendingReviewDetail.body.keyResults) {
      await leader
        .put(`/api/leader/key-results/${keyResult.id}/score`)
        .send({
          score: keyResult.points,
          comment: keyResult.id === secondKeyResultId ? 'Missing proof but still scoreable after auto review' : 'Full score after review'
        })
        .expect(200);
    }

    const completedDetail = await employee.get(`/api/employee/goals/${goalId}`).expect(200);
    expect(completedDetail.body.status).toBe('completed');

    await employee
      .put(`/api/employee/key-results/${firstKeyResultId}/completion`)
      .send({
        completionState: 'incomplete'
      })
      .expect(400);

    await employee
      .post(`/api/employee/key-results/${secondKeyResultId}/proofs`)
      .field('note', 'completed upload still allowed')
      .attach('file', Buffer.from('completed-proof', 'utf8'), 'completed-proof.txt')
      .expect(201);
  });
});

function getPreviousQuarterPeriod(date = new Date()) {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  if (quarter === 1) {
    return {
      year: date.getFullYear() - 1,
      quarter: 4
    };
  }

  return {
    year: date.getFullYear(),
    quarter: quarter - 1
  };
}
