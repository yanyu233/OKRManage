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

  it('persists template key result score types through admin bootstrap save', async () => {
    const agent = await loginAsSysadmin(app);
    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);
    const departmentId = bootstrap.body.departments[0].id as string;

    await agent
      .put('/api/admin/org/bootstrap')
      .send({
        ...bootstrap.body,
        goalTemplates: [
          ...bootstrap.body.goalTemplates,
          {
            id: 'template-score-types',
            departmentId,
            name: '模板评分类型校验',
            description: '验证模板 KR 的评分类型会被保存',
            isActive: true,
            keyResults: [
              {
                id: 'template-score-types-kr-1',
                code: 'KR1',
                name: '客观项 KR',
                description: null,
                points: 30,
                scoreType: 'objective'
              },
              {
                id: 'template-score-types-kr-2',
                code: 'KR2',
                name: '主观项 KR',
                description: null,
                points: 20,
                scoreType: 'subjective'
              }
            ]
          }
        ]
      })
      .expect(200);

    const refreshed = await agent.get('/api/admin/org/bootstrap').expect(200);
    const savedTemplate = refreshed.body.goalTemplates.find((entry: { id: string }) => entry.id === 'template-score-types');

    expect(savedTemplate).toMatchObject({
      id: 'template-score-types',
      departmentId,
      keyResults: [
        expect.objectContaining({
          code: 'KR1',
          scoreType: 'objective'
        }),
        expect.objectContaining({
          code: 'KR2',
          scoreType: 'subjective'
        })
      ]
    });
  });
});
