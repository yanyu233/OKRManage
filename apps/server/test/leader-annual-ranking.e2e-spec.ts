import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSectionLeader } from './support/test-app';
import { CURRENT_DEMO_EMPLOYEES } from './support/current-demo-data';

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

  it('returns annual scores by summing quarter scores on the current demo baseline', async () => {
    const agent = await loginAsSectionLeader(app);
    const response = await agent.get('/api/leader/annual-ranking?year=2026').expect(200);

    expect(response.body.ranking[0]).toEqual(
      expect.objectContaining({
        employeeName: CURRENT_DEMO_EMPLOYEES.topRankEmployee.name,
        annualScore: CURRENT_DEMO_EMPLOYEES.topRankEmployee.annualScore,
        quarterScores: CURRENT_DEMO_EMPLOYEES.topRankEmployee.quarterScores
      })
    );

    expect(response.body.ranking).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeName: CURRENT_DEMO_EMPLOYEES.employeeLeader.name,
          annualScore: CURRENT_DEMO_EMPLOYEES.employeeLeader.annualScore,
          quarterScores: [
            { quarter: 1, score: 58 },
            { quarter: 2, score: 72 },
            { quarter: 3, score: 0 },
            { quarter: 4, score: 0 }
          ]
        }),
        expect.objectContaining({
          employeeName: CURRENT_DEMO_EMPLOYEES.secondRankEmployee.name,
          annualScore: CURRENT_DEMO_EMPLOYEES.secondRankEmployee.annualScore,
          quarterScores: CURRENT_DEMO_EMPLOYEES.secondRankEmployee.quarterScores
        }),
        expect.objectContaining({
          employeeName: CURRENT_DEMO_EMPLOYEES.outOfScopeEmployee.name,
          annualScore: CURRENT_DEMO_EMPLOYEES.outOfScopeEmployee.annualScore,
          quarterScores: [
            { quarter: 1, score: 66 },
            { quarter: 2, score: 0 },
            { quarter: 3, score: 0 },
            { quarter: 4, score: 0 }
          ]
        })
      ])
    );

    expect(response.body.selectedEmployee).toEqual(
      expect.objectContaining({
        employeeName: CURRENT_DEMO_EMPLOYEES.topRankEmployee.name,
        annualScore: CURRENT_DEMO_EMPLOYEES.topRankEmployee.annualScore
      })
    );
  });
});
