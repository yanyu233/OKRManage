import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { closeTestDatabase, readAuditRows, readSessionRows, resetTestDatabase } from './support/test-db';
import { CURRENT_DEMO_LOGIN } from './support/current-demo-data';

describe('Manual debug login', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('creates a session for allowed local-debug users', async () => {
    const agent = request.agent(app.getHttpServer());

    const login = await agent.post('/api/auth/manual-login').send(CURRENT_DEMO_LOGIN.sysadmin).expect(200);

    expect(login.body.ok).toBe(true);
    expect(login.body.user.id).toBeDefined();

    const me = await agent.get('/api/me').expect(200);
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user.loginName).toBe(CURRENT_DEMO_LOGIN.sysadmin.loginName);
    expect(me.body.user.role).toBe('system-admin');
    expect(me.body.user.activeRole).toBe('system-admin');
    expect(me.body.user.roles).toEqual([
      {
        role: 'system-admin',
        isPrimary: true
      }
    ]);
    expect(me.body.user.id).not.toBe('u-sysadmin-debug');

    const sessionRows = await readSessionRows();
    expect(sessionRows.length).toBeGreaterThan(0);

    const auditRows = await readAuditRows('auth.manual-login.success');
    expect(auditRows.length).toBeGreaterThan(0);
  });

  it('returns all assigned roles for the current multi-role user', async () => {
    const agent = request.agent(app.getHttpServer());

    const login = await agent.post('/api/auth/manual-login').send(CURRENT_DEMO_LOGIN.multiRole).expect(200);

    expect(login.body.user.role).toBe('section-leader');
    expect(login.body.user.activeRole).toBe('section-leader');
    expect(login.body.user.roles).toEqual([
      {
        role: 'section-leader',
        isPrimary: true
      },
      {
        role: 'group-leader',
        isPrimary: false
      },
      {
        role: 'employee',
        isPrimary: false
      }
    ]);
  });
});
