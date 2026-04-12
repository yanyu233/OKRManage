import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee } from './support/test-app';

describe('Employee create goal', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('defaults self-created key results to objective score type', async () => {
    const agent = await loginAsEmployee(app);

    const response = await agent
      .post('/api/employee/goals')
      .send({
        year: 2026,
        quarter: 1,
        name: '员工自定客观目标',
        description: '验证默认评分类型',
        keyResults: [
          {
            code: 'KR1',
            name: '按时完成版本交付',
            description: null,
            points: 20
          }
        ]
      })
      .expect(201);

    expect(response.body).toMatchObject({
      code: 'O3',
      name: '员工自定客观目标',
      keyResults: [
        expect.objectContaining({
          code: 'KR1',
          scoreType: 'objective'
        })
      ]
    });
  });
});
