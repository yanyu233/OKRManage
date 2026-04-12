import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSectionLeader } from './support/test-app';

describe('Leader bulk score', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('scores only permitted key results and can exclude template goals', async () => {
    const agent = await loginAsSectionLeader(app);
    const workbench = await agent.get('/api/leader/workbench?year=2026&quarter=1').expect(200);

    const zhang = workbench.body.employees.find((entry: { name: string }) => entry.name === '张晨');
    const liLei = workbench.body.employees.find((entry: { name: string }) => entry.name === '李雷');
    const zhangView = await agent
      .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${zhang.id}`)
      .expect(200);
    const allowedKrIds = zhangView.body.selectedGoal.keyResults.slice(0, 2).map((entry: { id: string }) => entry.id);

    const liLeiView = await agent
      .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${liLei.id}`)
      .expect(200);
    const blockedKrId = liLeiView.body.selectedGoal.keyResults[0].id as string;

    const response = await agent
      .post('/api/leader/bulk-score')
      .send({
        year: 2026,
        quarter: 1,
        employeeIds: [zhang.id, liLei.id],
        keyResultIds: [...allowedKrIds, blockedKrId],
        score: 88,
        comment: '批量评分',
        overwriteExisting: true,
        excludeTemplateGoals: true
      })
      .expect(200);

    expect(response.body.updatedCount).toBe(allowedKrIds.length);
    expect(response.body.skippedCount).toBeGreaterThanOrEqual(1);
    expect(response.body.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyResultId: blockedKrId,
          reason: 'out-of-scope'
        })
      ])
    );
  });
});
