import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSectionLeader } from './support/test-app';
import { CURRENT_DEMO_EMPLOYEES, CURRENT_DEMO_REVIEW_GROUPS } from './support/current-demo-data';

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

  it('returns all review groups and ranks the current demo employees with the new baseline', async () => {
    const agent = await loginAsSectionLeader(app);
    const response = await agent.get('/api/leader/ranking?year=2026&quarter=1').expect(200);

    expect(response.body.reviewGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: CURRENT_DEMO_REVIEW_GROUPS.primary
        }),
        expect.objectContaining({
          name: CURRENT_DEMO_REVIEW_GROUPS.newHire
        }),
        expect.objectContaining({
          name: CURRENT_DEMO_REVIEW_GROUPS.operations
        })
      ])
    );
    expect(response.body.seatSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gradeCode: 'A+',
          seatCount: 0
        }),
        expect.objectContaining({
          gradeCode: 'A',
          seatCount: 0
        }),
        expect.objectContaining({
          gradeCode: 'B',
          seatCount: 0
        })
      ])
    );
    expect(response.body.ranking[0]).toEqual(
      expect.objectContaining({
        employeeName: CURRENT_DEMO_EMPLOYEES.topRankEmployee.name,
        quarterScore: CURRENT_DEMO_EMPLOYEES.topRankEmployee.quarterOneScore,
        currentGrade: null
      })
    );
    expect(
      response.body.ranking.some(
        (entry: { employeeName: string; quarterScore: number | null }) =>
          entry.employeeName === CURRENT_DEMO_EMPLOYEES.employeeLeader.name &&
          entry.quarterScore === CURRENT_DEMO_EMPLOYEES.employeeLeader.quarterOneScore
      )
    ).toBe(true);
    expect(
      response.body.ranking.some(
        (entry: { employeeName: string; quarterScore: number | null }) =>
          entry.employeeName === CURRENT_DEMO_EMPLOYEES.secondRankEmployee.name &&
          entry.quarterScore === CURRENT_DEMO_EMPLOYEES.secondRankEmployee.quarterOneScore
      )
    ).toBe(true);
    expect(response.body.selectedEmployee).toEqual(
      expect.objectContaining({
        employeeName: CURRENT_DEMO_EMPLOYEES.topRankEmployee.name,
        quarterScore: CURRENT_DEMO_EMPLOYEES.topRankEmployee.quarterOneScore
      })
    );
  });
});
