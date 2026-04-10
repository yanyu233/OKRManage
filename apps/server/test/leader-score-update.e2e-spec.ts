import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, readAuditRows, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSectionLeader } from './support/test-app';

describe('Leader KR score update', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('persists score changes and allows later edits', async () => {
    const agent = await loginAsSectionLeader(app);
    const workbench = await agent.get('/api/leader/workbench?year=2026&quarter=1').expect(200);
    const kr = workbench.body.selectedGoal.keyResults.find((entry: { code: string }) => entry.code === 'KR1');

    await agent
      .put(`/api/leader/key-results/${kr.id}/score`)
      .send({
        score: 92.5,
        comment: 'Strong delivery evidence'
      })
      .expect(200);

    await agent
      .put(`/api/leader/key-results/${kr.id}/score`)
      .send({
        score: 88,
        comment: 'Adjusted after review'
      })
      .expect(200);

    const refreshed = await agent.get('/api/leader/workbench?year=2026&quarter=1').expect(200);
    const refreshedKr = refreshed.body.selectedGoal.keyResults.find((entry: { id: string }) => entry.id === kr.id);

    expect(refreshedKr.reviewScore).toBe(88);
    expect(refreshedKr.reviewComment).toBe('Adjusted after review');

    const auditRows = await readAuditRows('leader.kr.score.update');
    expect(auditRows.length).toBeGreaterThanOrEqual(2);
  });
});
