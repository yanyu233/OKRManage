import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee, loginAsSectionLeader } from './support/test-app';

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
    const employee = await loginAsEmployee(app);
    const employeeQuarter = await employee.get('/api/employee/okr?year=2026&quarter=1').expect(200);
    const templates = await employee.get('/api/employee/goal-templates?year=2026&quarter=1').expect(200);
    const templateId = templates.body.templates[0].id as string;

    await employee
      .post('/api/employee/goal-templates/import')
      .send({
        year: 2026,
        quarter: 1,
        templateIds: [templateId]
      })
      .expect(201);

    const agent = await loginAsSectionLeader(app);
    const workbench = await agent.get('/api/leader/workbench?year=2026&quarter=1').expect(200);

    const zhang = workbench.body.employees.find((entry: { id: string }) => entry.id === employeeQuarter.body.employee.id);
    const liLei = workbench.body.employees.find((entry: { canScore: boolean }) => !entry.canScore);
    const zhangView = await agent
      .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${zhang.id}`)
      .expect(200);
    const allowedGoal = zhangView.body.goals.find((entry: { id: string; isTemplateGoal: boolean }) => !entry.isTemplateGoal);
    const templateGoal = zhangView.body.goals.find((entry: { id: string; isTemplateGoal: boolean }) => entry.isTemplateGoal);

    const allowedGoalView = await agent
      .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${zhang.id}&goalId=${allowedGoal.id}`)
      .expect(200);
    const templateGoalView = await agent
      .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${zhang.id}&goalId=${templateGoal.id}`)
      .expect(200);

    const allowedKrIds = allowedGoalView.body.selectedGoal.keyResults.slice(0, 2).map((entry: { id: string }) => entry.id);
    const excludedTemplateKrId = templateGoalView.body.selectedGoal.keyResults[0].id as string;

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
        keyResultIds: [...allowedKrIds, excludedTemplateKrId, blockedKrId],
        score: 88,
        comment: '批量评分',
        overwriteExisting: true,
        excludeTemplateGoals: true
      })
      .expect(200);

    expect(response.body.updatedCount).toBe(allowedKrIds.length);
    expect(response.body.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyResultId: blockedKrId,
          reason: 'out-of-scope'
        })
      ])
    );
  });

  it('skips subjective key results during objective bulk scoring', async () => {
    const employee = await loginAsEmployee(app);
    const created = await employee
      .post('/api/employee/goals')
      .send({
        year: 2026,
        quarter: 1,
        name: '客观与主观混合目标',
        description: '验证批量评分只处理客观项',
        keyResults: [
          {
            code: 'KR1',
            name: '客观 KR',
            description: null,
            points: 20,
            scoreType: 'objective'
          },
          {
            code: 'KR2',
            name: '主观 KR',
            description: null,
            points: 30,
            scoreType: 'subjective'
          }
        ]
      })
      .expect(201);

    const leader = await loginAsSectionLeader(app);
    const response = await leader
      .post('/api/leader/bulk-score')
      .send({
        year: 2026,
        quarter: 1,
        employeeIds: [created.body.owner.id],
        keyResultIds: created.body.keyResults.map((entry: { id: string }) => entry.id),
        score: 100,
        comment: '客观项批量满分',
        overwriteExisting: true,
        excludeTemplateGoals: false
      })
      .expect(200);

    expect(response.body.updatedCount).toBe(1);
    expect(response.body.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'subjective-only'
        })
      ])
    );
  });
});
