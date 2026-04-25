import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee, loginAsSysadmin } from './support/test-app';

describe('Employee goal template import', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('inherits template key result score types when importing templates', async () => {
    const admin = await loginAsSysadmin(app);
    const bootstrap = await admin.get('/api/admin/org/bootstrap').expect(200);
    const departmentId = bootstrap.body.departments[0].id as string;

    await admin
      .put('/api/admin/org/bootstrap')
      .send({
        ...bootstrap.body,
        goalTemplates: [
          ...bootstrap.body.goalTemplates,
          {
            id: 'template-onboarding',
            departmentId,
            name: '新员工入项模板',
            description: '用于校验模板 KR 评分类型继承',
            isActive: true,
            keyResults: [
              {
                id: 'template-onboarding-kr-1',
                code: 'KR1',
                name: '客观模板 KR',
                description: null,
                points: 30,
                scoreType: 'objective'
              },
              {
                id: 'template-onboarding-kr-2',
                code: 'KR2',
                name: '主观模板 KR',
                description: null,
                points: 20,
                scoreType: 'subjective'
              }
            ]
          }
        ]
      })
      .expect(200);

    const employee = await loginAsEmployee(app);
    const imported = await employee
      .post('/api/employee/goal-templates/import')
      .send({
        year: 2028,
        quarter: 3,
        templateIds: ['template-onboarding']
      })
      .expect(201);

    const importedGoal = imported.body.importedGoals.find((goal: { id: string }) => goal.id);
    const detail = await employee.get(`/api/employee/goals/${importedGoal.id}`).expect(200);

    expect(detail.body.keyResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'KR1',
          scoreType: 'objective'
        }),
        expect.objectContaining({
          code: 'KR2',
          scoreType: 'subjective'
        })
      ])
    );
  });

  it('syncs imported template key result score types after admin updates the template', async () => {
    const admin = await loginAsSysadmin(app);
    const bootstrap = await admin.get('/api/admin/org/bootstrap').expect(200);
    const departmentId = bootstrap.body.departments[0].id as string;

    await admin
      .put('/api/admin/org/bootstrap')
      .send({
        ...bootstrap.body,
        goalTemplates: [
          ...bootstrap.body.goalTemplates,
          {
            id: 'template-sync-score-type',
            departmentId,
            name: '模板评分类型同步校验',
            description: '验证模板更新后已导入目标也会同步评分类型',
            isActive: true,
            keyResults: [
              {
                id: 'template-sync-score-type-kr-1',
                code: 'KR1',
                name: '创新能力',
                description: null,
                points: 20,
                scoreType: 'subjective'
              }
            ]
          }
        ]
      })
      .expect(200);

    const employee = await loginAsEmployee(app);
    const imported = await employee
      .post('/api/employee/goal-templates/import')
      .send({
        year: 2028,
        quarter: 4,
        templateIds: ['template-sync-score-type']
      })
      .expect(201);

    const importedGoal = imported.body.importedGoals[0];
    const beforeSync = await employee.get(`/api/employee/goals/${importedGoal.id}`).expect(200);
    expect(beforeSync.body.keyResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'KR1',
          scoreType: 'subjective'
        })
      ])
    );

    const refreshedBootstrap = await admin.get('/api/admin/org/bootstrap').expect(200);

    await admin
      .put('/api/admin/org/bootstrap')
      .send({
        ...refreshedBootstrap.body,
        goalTemplates: refreshedBootstrap.body.goalTemplates.map((template: { id: string; keyResults: Array<{ id: string }> }) =>
          template.id === 'template-sync-score-type'
            ? {
                ...template,
                keyResults: template.keyResults.map((keyResult: { id: string }) =>
                  keyResult.id === 'template-sync-score-type-kr-1'
                    ? {
                        ...keyResult,
                        scoreType: 'objective'
                      }
                    : keyResult
                )
              }
            : template
        )
      })
      .expect(200);

    const afterSync = await employee.get(`/api/employee/goals/${importedGoal.id}`).expect(200);
    expect(afterSync.body.keyResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'KR1',
          scoreType: 'objective'
        })
      ])
    );
  });

  it('rejects template import when quarter total points would exceed 100', async () => {
    const admin = await loginAsSysadmin(app);
    const bootstrap = await admin.get('/api/admin/org/bootstrap').expect(200);
    const departmentId = bootstrap.body.departments[0].id as string;

    await admin
      .put('/api/admin/org/bootstrap')
      .send({
        ...bootstrap.body,
        goalTemplates: [
          ...bootstrap.body.goalTemplates,
          {
            id: 'template-over-budget',
            departmentId,
            name: '超分模板目标',
            description: '验证季度总分上限',
            isActive: true,
            keyResults: [
              {
                id: 'template-over-budget-kr-1',
                code: 'KR1',
                name: '超分模板 KR',
                description: null,
                points: 15,
                scoreType: 'objective'
              }
            ]
          }
        ]
      })
      .expect(200);

    const employee = await loginAsEmployee(app);

    await employee
      .post('/api/employee/goals')
      .send({
        year: 2027,
        quarter: 3,
        name: '季度基准目标',
        description: '先占用 90 分额度',
        keyResults: [
          {
            code: 'KR1',
            name: '季度基准结果',
            description: null,
            points: 90
          }
        ]
      })
      .expect(201);

    await employee
      .post('/api/employee/goal-templates/import')
      .send({
        year: 2027,
        quarter: 3,
        templateIds: ['template-over-budget']
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('quarter total points cannot exceed 100');
      });
  });
});
