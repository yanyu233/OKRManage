import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, readAuditRows, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee, loginAsSectionLeader, loginAsSysadmin } from './support/test-app';

jest.setTimeout(30_000);

describe('Leader KR score update', () => {
  let app!: INestApplication;

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('persists actual point scores and allows later edits even after the goal is completed', async () => {
    const employee = await loginAsEmployee(app);
    const reviewPeriod = getPreviousQuarterPeriod();
    const created = await employee
      .post('/api/employee/goals')
      .send({
        year: reviewPeriod.year,
        quarter: reviewPeriod.quarter,
        name: 'Leader score workflow goal',
        description: 'Pending review goal for leader scoring',
        keyResults: [
          {
            code: 'KR1',
            name: 'Leader score KR',
            description: null,
            points: 5
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
    const transition = await sysadmin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: reviewPeriod.year,
        quarter: reviewPeriod.quarter,
        userId: created.body.owner.id,
        targetStatus: 'confirmed'
      })
      .expect(200);
    expect(transition.body.autoAdvancedGoalCount).toBeGreaterThan(0);

    const agent = await loginAsSectionLeader(app);
    const workbench = await agent
      .get(
        `/api/leader/workbench?year=${reviewPeriod.year}&quarter=${reviewPeriod.quarter}&employeeId=${created.body.owner.id}&goalId=${created.body.id}`
      )
      .expect(200);
    const kr = workbench.body.selectedGoal.keyResults.find((entry: { code: string }) => entry.code === 'KR1');

    await agent
      .put(`/api/leader/key-results/${kr.id}/score`)
      .send({
        score: 5,
        comment: 'Strong delivery evidence'
      })
      .expect(200);

    const secondKr = workbench.body.selectedGoal.keyResults.find((entry: { code: string }) => entry.code === 'KR2');

    await agent
      .put(`/api/leader/key-results/${secondKr.id}/score`)
      .send({
        score: 5,
        comment: 'Goal completed by full scoring'
      })
      .expect(200);

    await agent
      .put(`/api/leader/key-results/${kr.id}/score`)
      .send({
        score: 4,
        comment: 'Adjusted after review'
      })
      .expect(200);

    const refreshed = await agent
      .get(
        `/api/leader/workbench?year=${reviewPeriod.year}&quarter=${reviewPeriod.quarter}&employeeId=${created.body.owner.id}&goalId=${created.body.id}`
      )
      .expect(200);
    const refreshedKr = refreshed.body.selectedGoal.keyResults.find((entry: { id: string }) => entry.id === kr.id);

    expect(refreshed.body.selectedGoal.status).toBe('completed');
    expect(refreshedKr.reviewScore).toBe(4);
    expect(refreshedKr.reviewComment).toBe('Adjusted after review');

    const auditRows = await readAuditRows('leader.kr.score.update');
    expect(auditRows.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects scores above the key result points ceiling', async () => {
    const employee = await loginAsEmployee(app);
    const reviewPeriod = getPreviousQuarterPeriod();
    const created = await employee
      .post('/api/employee/goals')
      .send({
        year: reviewPeriod.year,
        quarter: reviewPeriod.quarter,
        name: 'Leader score ceiling goal',
        description: 'Pending review goal for ceiling validation',
        keyResults: [
          {
            code: 'KR1',
            name: 'Ceiling KR',
            description: null,
            points: 10
          }
        ]
      })
      .expect(201);

    const sysadmin = await loginAsSysadmin(app);
    const transition = await sysadmin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: reviewPeriod.year,
        quarter: reviewPeriod.quarter,
        userId: created.body.owner.id,
        targetStatus: 'confirmed'
      })
      .expect(200);
    expect(transition.body.autoAdvancedGoalCount).toBeGreaterThan(0);

    const agent = await loginAsSectionLeader(app);
    const workbench = await agent
      .get(
        `/api/leader/workbench?year=${reviewPeriod.year}&quarter=${reviewPeriod.quarter}&employeeId=${created.body.owner.id}&goalId=${created.body.id}`
      )
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

function getPreviousQuarterPeriod(date = new Date()) {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  if (quarter === 1) {
    return {
      year: date.getFullYear() - 1,
      quarter: 4
    };
  }

  return {
    year: date.getFullYear(),
    quarter: quarter - 1
  };
}
