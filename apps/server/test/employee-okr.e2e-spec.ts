import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee } from './support/test-app';
import { CURRENT_DEMO_EMPLOYEES, CURRENT_DEMO_GOALS } from './support/current-demo-data';

describe('Employee OKR list', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('returns the signed-in employee quarter summary and goals', async () => {
    const agent = await loginAsEmployee(app);

    const response = await agent.get('/api/employee/okr?year=2026&quarter=1').expect(200);

    expect(response.body.employee).toEqual(
      expect.objectContaining({
        name: CURRENT_DEMO_EMPLOYEES.employeeLeader.name,
        goalCount: 2,
        keyResultCount: 6
      })
    );
    expect(response.body.goals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: CURRENT_DEMO_GOALS.employeeQuarterOnePrimary.code,
          name: CURRENT_DEMO_GOALS.employeeQuarterOnePrimary.name
        }),
        expect.objectContaining({
          code: CURRENT_DEMO_GOALS.employeeQuarterOneSecondary.code,
          name: CURRENT_DEMO_GOALS.employeeQuarterOneSecondary.name
        })
      ])
    );
  });
});
