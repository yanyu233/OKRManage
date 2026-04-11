import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSectionLeader } from './support/test-app';

describe('Leader ranking', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('returns ranked employees and fixed-seat grade allocation for a review group', async () => {
    const agent = await loginAsSectionLeader(app);
    const response = await agent.get('/api/leader/ranking?year=2026&quarter=1').expect(200);

    expect(response.body.reviewGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '信息化组'
        })
      ])
    );
    expect(response.body.seatSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gradeCode: 'A+',
          seatCount: 1
        }),
        expect.objectContaining({
          gradeCode: 'B+',
          seatCount: 1
        })
      ])
    );
    expect(response.body.ranking[0]).toEqual(
      expect.objectContaining({
        employeeName: '王敏',
        currentGrade: 'A+'
      })
    );
    expect(
      response.body.ranking.some(
        (entry: { employeeName: string; currentGrade: string }) => entry.employeeName === '张晨' && entry.currentGrade === 'B+'
      )
    ).toBe(true);
  });
});
