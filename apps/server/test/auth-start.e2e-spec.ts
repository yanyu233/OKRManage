import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSysadmin } from './support/test-app';

describe('Auth start', () => {
  const originalAuthMode = process.env.AUTH_MODE;
  let app: INestApplication;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    process.env.AUTH_MODE = originalAuthMode;
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('returns manual-login action in local-debug mode when unauthenticated', async () => {
    process.env.AUTH_MODE = 'local-debug';
    await resetTestDatabase();
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .get('/api/auth/start?returnTo=%2Femployee%2Fokr')
      .expect(200);

    expect(response.body).toEqual({
      action: 'manual-login',
      redirectTo: '/login?returnTo=%2Femployee%2Fokr'
    });
  });

  it('returns session action when a valid session already exists', async () => {
    process.env.AUTH_MODE = 'local-debug';
    await resetTestDatabase();
    app = await createTestApp();
    const agent = await loginAsSysadmin(app);

    const response = await agent.get('/api/auth/start?returnTo=%2Fadmin%2Forg').expect(200);

    expect(response.body).toEqual({
      action: 'session',
      redirectTo: '/admin/org'
    });
  });

  it('returns wecom action in wecom-preferred mode when unauthenticated', async () => {
    process.env.AUTH_MODE = 'wecom-preferred';
    await resetTestDatabase();
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .get('/api/auth/start?returnTo=%2Fleader%2Fworkbench')
      .expect(200);

    expect(response.body).toEqual({
      action: 'wecom',
      redirectTo: '/api/auth/wecom/start?returnTo=%2Fleader%2Fworkbench'
    });
  });
});
