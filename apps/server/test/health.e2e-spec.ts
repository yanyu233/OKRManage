import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('Health endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns service health', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.service).toBe('okr-node-foundation');
    expect(response.body.database).toEqual(
      expect.objectContaining({
        ok: expect.any(Boolean)
      })
    );
  });
});
