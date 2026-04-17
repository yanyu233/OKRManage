import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee, loginAsSectionLeader, loginAsSysadmin } from './support/test-app';

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

  it('scores regular key results and leaves template goals untouched when excluded', async () => {
    const employee = await loginAsLocalEmployee(app, 'wang.min');
    const targetYear = 2025;
    const targetQuarter = 4;

    const created = await employee
      .post('/api/employee/goals')
      .send({
        year: targetYear,
        quarter: targetQuarter,
        name: 'Bulk score regular goal',
        description: 'Created for bulk score validation',
        keyResults: [
          {
            code: 'KR1',
            name: 'Bulk objective KR 1',
            description: null,
            points: 20,
            scoreType: 'objective'
          },
          {
            code: 'KR2',
            name: 'Bulk objective KR 2',
            description: null,
            points: 15,
            scoreType: 'objective'
          }
        ]
      })
      .expect(201);

    const templates = await employee
      .get(`/api/employee/goal-templates?year=${targetYear}&quarter=${targetQuarter}`)
      .expect(200);
    const templateId = templates.body.templates[0].id as string;

    await employee
      .post('/api/employee/goal-templates/import')
      .send({
        year: targetYear,
        quarter: targetQuarter,
        templateIds: [templateId]
      })
      .expect(201);

    const refreshedQuarter = await employee
      .get(`/api/employee/okr?year=${targetYear}&quarter=${targetQuarter}`)
      .expect(200);
    const allowedGoal = refreshedQuarter.body.goals.find((entry: { id: string }) => entry.id === created.body.id);
    const templateGoal = refreshedQuarter.body.goals.find((entry: { id: string }) => entry.id !== created.body.id);

    const sysadmin = await loginAsSysadmin(app);
    await sysadmin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: targetYear,
        quarter: targetQuarter,
        userId: created.body.owner.id,
        targetStatus: 'confirmed'
      })
      .expect(200);

    for (const goal of [allowedGoal, templateGoal]) {
      const detail = await employee.get(`/api/employee/goals/${goal.id}`).expect(200);

      for (const keyResult of detail.body.keyResults) {
        if (goal.id === allowedGoal.id) {
          await employee
            .post(`/api/employee/key-results/${keyResult.id}/proofs`)
            .attach('file', Buffer.from(`proof-${keyResult.id}`, 'utf8'), `${keyResult.code}.txt`)
            .expect(201);
        }
      }

    }

    const leader = await loginAsSectionLeader(app);
    const allowedGoalView = await leader
      .get(
        `/api/leader/workbench?year=${targetYear}&quarter=${targetQuarter}&employeeId=${created.body.owner.id}&goalId=${allowedGoal.id}`
      )
      .expect(200);
    const templateGoalView = await leader
      .get(
        `/api/leader/workbench?year=${targetYear}&quarter=${targetQuarter}&employeeId=${created.body.owner.id}&goalId=${templateGoal.id}`
      )
      .expect(200);

    const allowedKrIds = allowedGoalView.body.selectedGoal.keyResults.map((entry: { id: string }) => entry.id);
    const excludedTemplateKrId = templateGoalView.body.selectedGoal.keyResults[0].id as string;

    const response = await leader
      .post('/api/leader/bulk-score')
      .send({
        year: targetYear,
        quarter: targetQuarter,
        employeeIds: [created.body.owner.id],
        keyResultIds: [...allowedKrIds, excludedTemplateKrId],
        comment: 'Template-aware bulk full score',
        overwriteExisting: true,
        excludeTemplateGoals: true
      })
      .expect(200);

    expect(response.body.updatedCount).toBe(allowedKrIds.length);

    const refreshedAllowedGoal = await leader
      .get(
        `/api/leader/workbench?year=${targetYear}&quarter=${targetQuarter}&employeeId=${created.body.owner.id}&goalId=${allowedGoal.id}`
      )
      .expect(200);
    const refreshedTemplateGoal = await leader
      .get(
        `/api/leader/workbench?year=${targetYear}&quarter=${targetQuarter}&employeeId=${created.body.owner.id}&goalId=${templateGoal.id}`
      )
      .expect(200);

    expect(
      refreshedAllowedGoal.body.selectedGoal.keyResults.every(
        (entry: { reviewScore: number; points: number }) => entry.reviewScore === entry.points
      )
    ).toBe(true);
    expect(refreshedTemplateGoal.body.selectedGoal.keyResults[0].reviewScore).toBeNull();
  });

  it('skips subjective key results during objective bulk scoring', async () => {
    const employee = await loginAsEmployee(app);
    const targetYear = 2025;
    const targetQuarter = 3;

    const created = await employee
      .post('/api/employee/goals')
      .send({
        year: targetYear,
        quarter: targetQuarter,
        name: 'Objective and subjective mix',
        description: 'Validates that bulk scoring ignores subjective items',
        keyResults: [
          {
            code: 'KR1',
            name: 'Objective KR',
            description: null,
            points: 20,
            scoreType: 'objective'
          },
          {
            code: 'KR2',
            name: 'Subjective KR',
            description: null,
            points: 30,
            scoreType: 'subjective'
          }
        ]
      })
      .expect(201);

    const sysadmin = await loginAsSysadmin(app);
    await sysadmin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: targetYear,
        quarter: targetQuarter,
        userId: created.body.owner.id,
        targetStatus: 'confirmed'
      })
      .expect(200);

    await employee
      .post(`/api/employee/key-results/${created.body.keyResults[0].id}/proofs`)
      .attach('file', Buffer.from('objective-proof', 'utf8'), 'objective-proof.txt')
      .expect(201);

    const leader = await loginAsSectionLeader(app);
    await leader
      .get(
        `/api/leader/workbench?year=${targetYear}&quarter=${targetQuarter}&employeeId=${created.body.owner.id}&goalId=${created.body.id}`
      )
      .expect(200);
    const response = await leader
      .post('/api/leader/bulk-score')
      .send({
        year: targetYear,
        quarter: targetQuarter,
        employeeIds: [created.body.owner.id],
        keyResultIds: created.body.keyResults.map((entry: { id: string }) => entry.id),
        comment: 'Objective-only bulk full score',
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

    const refreshed = await leader
      .get(
        `/api/leader/workbench?year=${targetYear}&quarter=${targetQuarter}&employeeId=${created.body.owner.id}&goalId=${created.body.id}`
      )
      .expect(200);
    const objectiveKr = refreshed.body.selectedGoal.keyResults.find((entry: { code: string }) => entry.code === 'KR1');
    const subjectiveKr = refreshed.body.selectedGoal.keyResults.find((entry: { code: string }) => entry.code === 'KR2');

    expect(objectiveKr.reviewScore).toBe(objectiveKr.points);
    expect(subjectiveKr.reviewScore).toBeNull();
  });

  it('skips key results without proofs by default and allows override when explicitly requested', async () => {
    const employee = await loginAsLocalEmployee(app, 'wang.min');
    const targetYear = 2025;
    const targetQuarter = 2;

    const created = await employee
      .post('/api/employee/goals')
      .send({
        year: targetYear,
        quarter: targetQuarter,
        name: 'Proof-sensitive bulk score goal',
        description: 'Validates proof-aware full-score behavior',
        keyResults: [
          {
            code: 'KR1',
            name: 'Objective KR with proof',
            description: null,
            points: 10,
            scoreType: 'objective'
          },
          {
            code: 'KR2',
            name: 'Objective KR without proof',
            description: null,
            points: 15,
            scoreType: 'objective'
          }
        ]
      })
      .expect(201);

    const sysadmin = await loginAsSysadmin(app);
    await sysadmin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: targetYear,
        quarter: targetQuarter,
        userId: created.body.owner.id,
        targetStatus: 'confirmed'
      })
      .expect(200);

    await employee
      .post(`/api/employee/key-results/${created.body.keyResults[0].id}/proofs`)
      .attach('file', Buffer.from('proof-ready', 'utf8'), 'proof-ready.txt')
      .expect(201);

    const leader = await loginAsSectionLeader(app);
    await leader
      .get(
        `/api/leader/workbench?year=${targetYear}&quarter=${targetQuarter}&employeeId=${created.body.owner.id}&goalId=${created.body.id}`
      )
      .expect(200);
    const firstResponse = await leader
      .post('/api/leader/bulk-score')
      .send({
        year: targetYear,
        quarter: targetQuarter,
        employeeIds: [created.body.owner.id],
        keyResultIds: created.body.keyResults.map((entry: { id: string }) => entry.id),
        comment: 'Default proof-aware batch scoring',
        overwriteExisting: true,
        excludeTemplateGoals: false
      })
      .expect(200);

    expect(firstResponse.body.updatedCount).toBe(1);
    expect(firstResponse.body.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyResultId: created.body.keyResults[1].id,
          reason: 'proof-missing'
        })
      ])
    );

    const afterDefault = await leader
      .get(
        `/api/leader/workbench?year=${targetYear}&quarter=${targetQuarter}&employeeId=${created.body.owner.id}&goalId=${created.body.id}`
      )
      .expect(200);
    const withProofKr = afterDefault.body.selectedGoal.keyResults.find((entry: { code: string }) => entry.code === 'KR1');
    const withoutProofKr = afterDefault.body.selectedGoal.keyResults.find((entry: { code: string }) => entry.code === 'KR2');

    expect(withProofKr.reviewScore).toBe(withProofKr.points);
    expect(withoutProofKr.reviewScore).toBeNull();

    const forcedResponse = await leader
      .post('/api/leader/bulk-score')
      .send({
        year: targetYear,
        quarter: targetQuarter,
        employeeIds: [created.body.owner.id],
        keyResultIds: [created.body.keyResults[1].id],
        comment: 'Force score missing-proof KR',
        overwriteExisting: true,
        excludeTemplateGoals: false,
        allowMissingProofs: true
      })
      .expect(200);

    expect(forcedResponse.body.updatedCount).toBe(1);
    expect(forcedResponse.body.skipped).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyResultId: created.body.keyResults[1].id,
          reason: 'proof-missing'
        })
      ])
    );

    const afterForced = await leader
      .get(
        `/api/leader/workbench?year=${targetYear}&quarter=${targetQuarter}&employeeId=${created.body.owner.id}&goalId=${created.body.id}`
      )
      .expect(200);
    const forcedKr = afterForced.body.selectedGoal.keyResults.find((entry: { code: string }) => entry.code === 'KR2');

    expect(forcedKr.reviewScore).toBe(forcedKr.points);
  });
});

async function loginAsLocalEmployee(app: INestApplication, loginName: string) {
  const agent = request.agent(app.getHttpServer());

  await agent.post('/api/auth/manual-login').send({
    loginName,
    password: 'Employee123!'
  }).expect(200);

  return agent;
}
