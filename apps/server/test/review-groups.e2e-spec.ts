import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSysadmin } from './support/test-app';

const GRADE_CODES = ['A+', 'A', 'B', 'C', 'D'] as const;

describe('Review group admin config', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('creates, renames, quotas, rejects overflow, and deletes review groups', async () => {
    const agent = await loginAsSysadmin(app);

    const createResponse = await agent
      .post('/api/admin/review-groups')
      .send({
        name: 'Test Group'
      })
      .expect(201);

    expect(createResponse.body.name).toBe('Test Group');

    const reviewGroupId = createResponse.body.id as string;

    const renameResponse = await agent
      .patch(`/api/admin/review-groups/${reviewGroupId}`)
      .send({
        name: 'Test Group Renamed'
      })
      .expect(200);

    expect(renameResponse.body.name).toBe('Test Group Renamed');

    const quotasResponse = await agent
      .put(`/api/admin/review-groups/${reviewGroupId}/quotas`)
      .send({
        quotas: GRADE_CODES.map((gradeCode) => ({
          gradeCode,
          seatCount: 0
        }))
      })
      .expect(200);

    expect(quotasResponse.body.ok).toBe(true);

    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);
    const seededReviewGroup = bootstrap.body.reviewGroups.find(
      (reviewGroup: { name: string; id: string; memberCount: number }) => reviewGroup.name === '\u4fe1\u606f\u5316\u7ec4'
    );

    expect(seededReviewGroup?.id).toBeDefined();

    await agent
      .put(`/api/admin/review-groups/${seededReviewGroup.id}/quotas`)
      .send({
        quotas: [
          { gradeCode: 'A+', seatCount: (seededReviewGroup.memberCount ?? 0) + 1 },
          { gradeCode: 'A', seatCount: 0 },
          { gradeCode: 'B', seatCount: 0 },
          { gradeCode: 'C', seatCount: 0 },
          { gradeCode: 'D', seatCount: 0 }
        ]
      })
      .expect(400);

    const deleteResponse = await agent.delete(`/api/admin/review-groups/${reviewGroupId}`).expect(200);
    expect(deleteResponse.body.ok).toBe(true);
  });
});
