import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee, loginAsSectionLeader } from './support/test-app';

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
    const zhang = response.body.employees.find((entry: { name: string }) => entry.name === '张晨');
    const liLei = response.body.employees.find((entry: { name: string }) => entry.name === '李雷');

    expect(response.body.employees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '张晨',
          canScore: true
        }),
        expect.objectContaining({
          name: '王敏',
          canScore: true
        }),
        expect.objectContaining({
          name: '李雷',
          canScore: false
        })
      ])
    );
    expect(zhang).toBeTruthy();
    expect(liLei).toBeTruthy();
    expect(zhang).toEqual(
      expect.objectContaining({
        canScore: true,
        missingProofKeyResultCount: expect.any(Number)
      })
    );

    const zhangResponse = await agent
      .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${zhang.id}`)
      .expect(200);

    const selectedResponse = await agent
      .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${liLei.id}`)
      .expect(200);

    expect(selectedResponse.body.selectedEmployee).toEqual(
      expect.objectContaining({
        name: '李雷',
        canScore: false
      })
    );
    expect(selectedResponse.body.goals[0]).toEqual(
      expect.objectContaining({
        canScore: false
      })
    );
    expect(selectedResponse.body.selectedGoal.keyResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'KR1',
          canScore: false,
          hasProofs: expect.any(Boolean),
          isProofMissing: expect.any(Boolean)
        })
      ])
    );

    expect(zhangResponse.body.selectedGoal).toEqual(
      expect.objectContaining({
        status: 'pending-review',
        missingProofKeyResultCount: expect.any(Number)
      })
    );
    expect(zhangResponse.body.selectedGoal.keyResults).toEqual(
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
          id: zhang.id,
          name: '张晨',
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
