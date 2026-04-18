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
        year: 2028,
        quarter: 2,
        name: '员工自建目标',
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
      code: 'O1',
      name: '员工自建目标',
      keyResults: [
        expect.objectContaining({
          code: 'KR1',
          scoreType: 'objective'
        })
      ]
    });
  });

  it('rejects goals when quarter total points would exceed 100', async () => {
    const agent = await loginAsEmployee(app);

    await agent
      .post('/api/employee/goals')
      .send({
        year: 2027,
        quarter: 4,
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

    await agent
      .post('/api/employee/goals')
      .send({
        year: 2027,
        quarter: 4,
        name: '超分目标',
        description: '验证季度总分上限',
        keyResults: [
          {
            code: 'KR1',
            name: '超出总分限制',
            description: null,
            points: 11
          }
        ]
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('quarter total points cannot exceed 100');
      });
  });
});
