import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSectionLeader } from './support/test-app';

describe('Leader annual ranking', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
    await closeTestDatabase();
  });

  it('returns annual scores by summing quarter scores and treating missing quarters as zero', async () => {
    const agent = await loginAsSectionLeader(app);
    const response = await agent.get('/api/leader/annual-ranking?year=2026').expect(200);

    expect(response.body.ranking[0]).toEqual(
      expect.objectContaining({
        employeeName: '王敏',
        annualScore: 156.7,
        quarterScores: [
          { quarter: 1, score: 90.7 },
          { quarter: 2, score: 66 },
          { quarter: 3, score: 0 },
          { quarter: 4, score: 0 }
        ]
      })
    );

    expect(response.body.ranking).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeName: '张晨',
          annualScore: 137,
          quarterScores: [
            { quarter: 1, score: 58 },
            { quarter: 2, score: 0 },
            { quarter: 3, score: 79 },
            { quarter: 4, score: 0 }
          ]
        }),
        expect.objectContaining({
          employeeName: '李雷',
          annualScore: 49.5,
          quarterScores: [
            { quarter: 1, score: 49.5 },
            { quarter: 2, score: 0 },
            { quarter: 3, score: 0 },
            { quarter: 4, score: 0 }
          ]
        })
      ])
    );

    expect(response.body.selectedEmployee).toEqual(
      expect.objectContaining({
        employeeName: '王敏',
        annualScore: 156.7
      })
    );
  });
});
