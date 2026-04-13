import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, readAuditRows, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee, loginAsSectionLeader, loginAsSysadmin } from './support/test-app';

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

  it('persists actual point scores and allows later edits', async () => {
    const employee = await loginAsEmployee(app);
    const created = await employee
      .post('/api/employee/goals')
      .send({
        year: 2026,
        quarter: 1,
        name: 'Leader score workflow goal',
        description: 'Pending review goal for leader scoring',
        keyResults: [
          {
            code: 'KR1',
            name: 'Leader score KR',
            description: null,
            points: 35
          },
          {
            code: 'KR2',
            name: 'Leader score KR two',
            description: null,
            points: 5
          }
        ]
      })
      .expect(201);

    const sysadmin = await loginAsSysadmin(app);
    await sysadmin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: 2026,
        quarter: 1,
        userId: created.body.owner.id,
        targetStatus: 'confirmed'
      })
      .expect(200);

    await employee
      .put(`/api/employee/key-results/${created.body.keyResults[0].id}/completion`)
      .send({
        completionState: 'completed'
      })
      .expect(200);

    await employee
      .put(`/api/employee/key-results/${created.body.keyResults[1].id}/completion`)
      .send({
        completionState: 'completed'
      })
      .expect(200);

    await employee.post(`/api/employee/goals/${created.body.id}/submit-review`).expect(200);

    const agent = await loginAsSectionLeader(app);
    const workbench = await agent
      .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${created.body.owner.id}&goalId=${created.body.id}`)
      .expect(200);
    const kr = workbench.body.selectedGoal.keyResults.find((entry: { code: string }) => entry.code === 'KR1');

    await agent
      .put(`/api/leader/key-results/${kr.id}/score`)
      .send({
        score: 30,
        comment: 'Strong delivery evidence'
      })
      .expect(200);

    await agent
      .put(`/api/leader/key-results/${kr.id}/score`)
      .send({
        score: 28,
        comment: 'Adjusted after review'
      })
      .expect(200);

    const refreshed = await agent
      .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${created.body.owner.id}&goalId=${created.body.id}`)
      .expect(200);
    const refreshedKr = refreshed.body.selectedGoal.keyResults.find((entry: { id: string }) => entry.id === kr.id);

    expect(refreshedKr.reviewScore).toBe(28);
    expect(refreshedKr.reviewComment).toBe('Adjusted after review');

    const auditRows = await readAuditRows('leader.kr.score.update');
    expect(auditRows.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects scores above the key result points ceiling', async () => {
    const employee = await loginAsEmployee(app);
    const created = await employee
      .post('/api/employee/goals')
      .send({
        year: 2026,
        quarter: 1,
        name: 'Leader score ceiling goal',
        description: 'Pending review goal for ceiling validation',
        keyResults: [
          {
            code: 'KR1',
            name: 'Ceiling KR',
            description: null,
            points: 12
          }
        ]
      })
      .expect(201);

    const sysadmin = await loginAsSysadmin(app);
    await sysadmin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: 2026,
        quarter: 1,
        userId: created.body.owner.id,
        targetStatus: 'confirmed'
      })
      .expect(200);

    await employee
      .put(`/api/employee/key-results/${created.body.keyResults[0].id}/completion`)
      .send({
        completionState: 'completed'
      })
      .expect(200);

    await employee.post(`/api/employee/goals/${created.body.id}/submit-review`).expect(200);

    const agent = await loginAsSectionLeader(app);
    const workbench = await agent
      .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${created.body.owner.id}&goalId=${created.body.id}`)
      .expect(200);
    const kr = workbench.body.selectedGoal.keyResults.find((entry: { code: string; points: number }) => entry.code === 'KR1');

    await agent
      .put(`/api/leader/key-results/${kr.id}/score`)
      .send({
        score: kr.points + 1,
        comment: 'Should not exceed configured points'
      })
      .expect(400);
  });
});
