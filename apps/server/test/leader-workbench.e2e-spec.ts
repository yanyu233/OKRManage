import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSectionLeader } from './support/test-app';
import { CURRENT_DEMO_EMPLOYEES } from './support/current-demo-data';

describe('Leader workbench', () => {
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

  it('returns proof readiness metadata, keeps out-of-scope users readonly, and exposes bulk preview catalog', async () => {
    const agent = await loginAsSectionLeader(app);
    const response = await agent.get('/api/leader/workbench?year=2026&quarter=1').expect(200);
    const chen = response.body.employees.find(
      (entry: { name: string }) => entry.name === CURRENT_DEMO_EMPLOYEES.employeeLeader.name
    );
    const yang = response.body.employees.find(
      (entry: { name: string }) => entry.name === CURRENT_DEMO_EMPLOYEES.topRankEmployee.name
    );
    const pan = response.body.employees.find(
      (entry: { name: string }) => entry.name === CURRENT_DEMO_EMPLOYEES.outOfScopeEmployee.name
    );

    expect(response.body.employees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: CURRENT_DEMO_EMPLOYEES.employeeLeader.name,
          canScore: true
        }),
        expect.objectContaining({
          name: CURRENT_DEMO_EMPLOYEES.topRankEmployee.name,
          canScore: true
        }),
        expect.objectContaining({
          name: CURRENT_DEMO_EMPLOYEES.outOfScopeEmployee.name,
          canScore: false
        })
      ])
    );
    expect(chen).toBeTruthy();
    expect(yang).toBeTruthy();
    expect(pan).toBeTruthy();
    expect(chen).toEqual(
      expect.objectContaining({
        canScore: true,
        missingProofKeyResultCount: expect.any(Number)
      })
    );

    const chenResponse = await agent
      .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${chen.id}`)
      .expect(200);

    const outOfScopeResponse = await agent
      .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${pan.id}`)
      .expect(200);

    expect(outOfScopeResponse.body.selectedEmployee).toEqual(
      expect.objectContaining({
        name: CURRENT_DEMO_EMPLOYEES.outOfScopeEmployee.name,
        canScore: false
      })
    );
    expect(outOfScopeResponse.body.goals[0]).toEqual(
      expect.objectContaining({
        canScore: false
      })
    );
    expect(outOfScopeResponse.body.selectedGoal.keyResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'KR1',
          canScore: false,
          hasProofs: expect.any(Boolean),
          isProofMissing: expect.any(Boolean)
        })
      ])
    );

    expect(chenResponse.body.selectedGoal).toEqual(
      expect.objectContaining({
        status: 'pending-review',
        missingProofKeyResultCount: expect.any(Number)
      })
    );
    expect(chenResponse.body.selectedGoal.keyResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hasProofs: true,
          isProofMissing: false
        }),
        expect.objectContaining({
          hasProofs: false,
          isProofMissing: true
        })
      ])
    );

    expect(response.body.bulkCatalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: chen.id,
          name: CURRENT_DEMO_EMPLOYEES.employeeLeader.name,
          goals: expect.arrayContaining([
            expect.objectContaining({
              keyResults: expect.arrayContaining([
                expect.objectContaining({
                  scoreType: expect.any(String),
                  hasProofs: expect.any(Boolean),
                  isProofMissing: expect.any(Boolean),
                  proofCount: expect.any(Number)
                })
              ])
            })
          ])
        })
      ])
    );
  });
});
