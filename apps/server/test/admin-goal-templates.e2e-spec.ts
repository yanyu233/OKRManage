import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSysadmin } from './support/test-app';

describe('Admin goal templates in bootstrap', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('persists department-bound goal templates through admin bootstrap save', async () => {
    const agent = await loginAsSysadmin(app);
    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);
    const departmentId = bootstrap.body.departments[0].id as string;

    await agent
      .put('/api/admin/org/bootstrap')
      .send({
        ...bootstrap.body,
        goalTemplates: [
          {
            id: 'template-okr-platform',
            departmentId,
            name: '平台科标准交付模板',
            description: '平台产品科季度标准目标',
            isActive: true,
            keyResults: [
              {
                id: 'template-kr-1',
                code: 'KR1',
                name: '完成季度版本交付',
                description: '按计划完成季度版本交付',
                points: 30
              },
              {
                id: 'template-kr-2',
                code: 'KR2',
                name: '沉淀季度知识库案例',
                description: '沉淀可复用案例',
                points: 20
              }
            ]
          }
        ]
      })
      .expect(200);

    const refreshed = await agent.get('/api/admin/org/bootstrap').expect(200);

    expect(refreshed.body.goalTemplates).toEqual([
      expect.objectContaining({
        name: '平台科标准交付模板',
        departmentId,
        keyResults: [
          expect.objectContaining({
            code: 'KR1',
            name: '完成季度版本交付',
            points: 30
          }),
          expect.objectContaining({
            code: 'KR2',
            name: '沉淀季度知识库案例',
            points: 20
          })
        ]
      })
    ]);
  });
});
