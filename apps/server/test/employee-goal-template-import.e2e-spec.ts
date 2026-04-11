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

  it('imports selected department templates once per quarter', async () => {
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
            name: '平台科新人入项模板',
            description: '用于新入项员工的季度目标导入',
            isActive: true,
            keyResults: [
              {
                id: 'template-onboarding-kr-1',
                code: 'KR1',
                name: '完成首批交付任务',
                description: '完成指定交付清单',
                points: 30
              },
              {
                id: 'template-onboarding-kr-2',
                code: 'KR2',
                name: '沉淀上手文档',
                description: '输出首版 FAQ 和环境说明',
                points: 20
              }
            ]
          }
        ]
      })
      .expect(200);

    const employee = await loginAsEmployee(app);

    const templates = await employee.get('/api/employee/goal-templates?year=2026&quarter=1').expect(200);
    expect(templates.body.templates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'template-onboarding',
          name: '平台科新人入项模板',
          alreadyImported: false
        })
      ])
    );

    const imported = await employee
      .post('/api/employee/goal-templates/import')
      .send({
        year: 2026,
        quarter: 1,
        templateIds: ['template-onboarding']
      })
      .expect(201);

    expect(imported.body.importedGoals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '平台科新人入项模板',
          totalPoints: 50,
          keyResultCount: 2
        })
      ])
    );

    const okr = await employee.get('/api/employee/okr?year=2026&quarter=1').expect(200);
    expect(okr.body.goals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '平台科新人入项模板'
        })
      ])
    );

    await employee
      .post('/api/employee/goal-templates/import')
      .send({
        year: 2026,
        quarter: 1,
        templateIds: ['template-onboarding']
      })
      .expect(400);
  });
});
