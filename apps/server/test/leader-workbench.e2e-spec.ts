import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSectionLeader } from './support/test-app';

describe('Leader workbench', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('returns only employees in the section leader scope with goals and key results', async () => {
    const agent = await loginAsSectionLeader(app);

    const response = await agent.get('/api/leader/workbench?year=2026&quarter=1').expect(200);

    expect(response.body.employees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Zhang Chen',
          goalCount: 2,
          keyResultCount: 6
        }),
        expect.objectContaining({
          name: 'Wang Min',
          goalCount: 1,
          keyResultCount: 3
        })
      ])
    );
    expect(response.body.employees.some((entry: { name: string }) => entry.name === 'Li Lei')).toBe(false);
    expect(response.body.selectedEmployee.name).toBe('Zhang Chen');
    expect(response.body.goals).toHaveLength(2);
    expect(response.body.selectedGoal.keyResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'KR1',
          name: 'Deliver 6 releases',
          points: 35,
          proofCount: 2
        })
      ])
    );
  });
});
