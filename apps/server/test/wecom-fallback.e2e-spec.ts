import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, readAuditRows, readSessionRows, resetTestDatabase } from './support/test-db';
import { createTestApp } from './support/test-app';

describe('WeCom auth skeleton', () => {
  const originalEnv = {
    AUTH_MODE: process.env.AUTH_MODE,
    APP_BASE_URL: process.env.APP_BASE_URL,
    WEB_BASE_URL: process.env.WEB_BASE_URL,
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

    restoreEnv();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('rejects missing WeCom config in wecom-preferred mode', async () => {
    process.env.AUTH_MODE = 'wecom-preferred';
    process.env.APP_BASE_URL = 'http://127.0.0.1:3000';
    process.env.WEB_BASE_URL = 'http://127.0.0.1:5173';
    delete process.env.WECOM_CORP_ID;
    delete process.env.WECOM_AGENT_ID;
    delete process.env.WECOM_SECRET;
    delete process.env.WECOM_REDIRECT_URI;

    await resetTestDatabase();
    app = await createTestApp();

    const response = await request(app.getHttpServer()).get('/api/auth/wecom/start').expect(503);

    expect(response.body.message).toContain('WeCom configuration is incomplete');
  });

  it('redirects an unmapped mock identity to the manual-login fallback', async () => {
    process.env.AUTH_MODE = 'wecom-preferred';
    process.env.APP_BASE_URL = 'http://127.0.0.1:3000';
    process.env.WEB_BASE_URL = 'http://127.0.0.1:5173';

    await resetTestDatabase();
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .get('/api/auth/wecom/callback?code=mock:unknown-user&state=%2Fleader%2Fworkbench')
      .redirects(0)
      .expect(302);

    expect(response.headers.location).toBe('http://127.0.0.1:5173/login?reason=unmapped&returnTo=%2Fleader%2Fworkbench');

    const auditRows = await readAuditRows('auth.wecom.login.unmapped');
    expect(auditRows.length).toBeGreaterThan(0);
  });

  it('creates a session for a mapped mock identity and redirects back into the app', async () => {
    process.env.AUTH_MODE = 'wecom-preferred';
    process.env.APP_BASE_URL = 'http://127.0.0.1:3000';
    process.env.WEB_BASE_URL = 'http://127.0.0.1:5173';

    await resetTestDatabase();
    app = await createTestApp();
    const agent = request.agent(app.getHttpServer());

    const response = await agent
      .get('/api/auth/wecom/callback?code=mock:zhangchen&state=%2Femployee%2Fokr')
      .redirects(0)
      .expect(302);

    expect(response.headers.location).toBe('http://127.0.0.1:5173/employee/okr');

    const me = await agent.get('/api/me').expect(200);
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user.name).toBe('Zhang Chen');
    expect(me.body.user.activeRole).toBe('employee');

    const auditRows = await readAuditRows('auth.wecom.login.success');
    expect(auditRows.length).toBeGreaterThan(0);

    const sessionRows = await readSessionRows();
    expect(sessionRows.length).toBeGreaterThan(0);
  });

  function restoreEnv() {
    process.env.AUTH_MODE = originalEnv.AUTH_MODE;
    process.env.APP_BASE_URL = originalEnv.APP_BASE_URL;
    process.env.WEB_BASE_URL = originalEnv.WEB_BASE_URL;
    process.env.WECOM_CORP_ID = originalEnv.WECOM_CORP_ID;
    process.env.WECOM_AGENT_ID = originalEnv.WECOM_AGENT_ID;
    process.env.WECOM_SECRET = originalEnv.WECOM_SECRET;
    process.env.WECOM_REDIRECT_URI = originalEnv.WECOM_REDIRECT_URI;
  }
});
