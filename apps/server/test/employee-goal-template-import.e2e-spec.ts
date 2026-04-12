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
            name: '平台科新人入项模板',
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
        year: 2026,
        quarter: 1,
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
});
