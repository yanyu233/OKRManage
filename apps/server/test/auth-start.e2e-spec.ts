import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSysadmin } from './support/test-app';

jest.setTimeout(20000);

describe('Auth start', () => {
  const originalEnv = {
    AUTH_MODE: process.env.AUTH_MODE,
    WECOM_CORP_ID: process.env.WECOM_CORP_ID,
    WECOM_AGENT_ID: process.env.WECOM_AGENT_ID,
    WECOM_SECRET: process.env.WECOM_SECRET,
    WECOM_REDIRECT_URI: process.env.WECOM_REDIRECT_URI
  };
  let app: INestApplication;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    process.env.AUTH_MODE = originalEnv.AUTH_MODE;
    process.env.WECOM_CORP_ID = originalEnv.WECOM_CORP_ID;
    process.env.WECOM_AGENT_ID = originalEnv.WECOM_AGENT_ID;
    process.env.WECOM_SECRET = originalEnv.WECOM_SECRET;
    process.env.WECOM_REDIRECT_URI = originalEnv.WECOM_REDIRECT_URI;
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

  it('returns manual-login action in wecom-preferred mode when WeCom config is unavailable', async () => {
    process.env.AUTH_MODE = 'wecom-preferred';
    delete process.env.WECOM_CORP_ID;
    delete process.env.WECOM_AGENT_ID;
    delete process.env.WECOM_SECRET;
    delete process.env.WECOM_REDIRECT_URI;
    await resetTestDatabase();
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .get('/api/auth/start?returnTo=%2Fleader%2Fworkbench')
      .expect(200);

    expect(response.body).toEqual({
      action: 'manual-login',
      redirectTo: '/login?returnTo=%2Fleader%2Fworkbench'
    });
  });

  it('returns wecom action in wecom-preferred mode when WeCom config is available', async () => {
    process.env.AUTH_MODE = 'wecom-preferred';
    process.env.WECOM_CORP_ID = 'ww-test-corp';
    process.env.WECOM_AGENT_ID = '1000002';
    process.env.WECOM_SECRET = 'test-secret';
    process.env.WECOM_REDIRECT_URI = 'http://127.0.0.1:3000/api/auth/wecom/callback';
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
