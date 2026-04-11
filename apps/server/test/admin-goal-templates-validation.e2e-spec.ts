import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSysadmin } from './support/test-app';

describe('Admin goal template validation in bootstrap', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('rejects duplicate key result codes inside one template', async () => {
    const agent = await loginAsSysadmin(app);
    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);
    const departmentId = bootstrap.body.departments[0].id as string;

    await agent
      .put('/api/admin/org/bootstrap')
      .send({
        ...bootstrap.body,
        goalTemplates: [
          {
            id: 'template-duplicate',
            departmentId,
            name: '重复编码模板',
            description: null,
            isActive: true,
            keyResults: [
              { id: 'template-duplicate-kr-1', code: 'KR1', name: '模板任务一', description: null, points: 20 },
              { id: 'template-duplicate-kr-2', code: 'KR1', name: '模板任务二', description: null, points: 30 }
            ]
          }
        ]
      })
      .expect(400);
  });
});
