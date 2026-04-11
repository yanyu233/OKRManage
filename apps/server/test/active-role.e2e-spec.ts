import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, loginAsSectionLeader } from './support/test-app';
import { closeTestDatabase, readAuditRows, resetTestDatabase } from './support/test-db';

describe('Active role switching', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('switches active role for a dual-role user', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent.post('/api/auth/manual-login').send({
      loginName: 'group.leader',
      password: 'Leader123!'
    }).expect(200);

    const switched = await agent
      .post('/api/auth/active-role')
      .send({ role: 'employee' })
      .expect(200);

    expect(switched.body.ok).toBe(true);
    expect(switched.body.user.activeRole).toBe('employee');
    expect(switched.body.user.role).toBe('employee');

    const me = await agent.get('/api/me').expect(200);
    expect(me.body.user.activeRole).toBe('employee');
    expect(me.body.user.roles).toEqual([
      {
        role: 'group-leader',
        isPrimary: true
      },
      {
        role: 'employee',
        isPrimary: false
      }
    ]);

    const auditRows = await readAuditRows('auth.active-role.switch');
    expect(auditRows.length).toBeGreaterThan(0);
  });

  it('rejects switching to an unassigned role', async () => {
    const agent = await loginAsSectionLeader(app);

    const response = await agent
      .post('/api/auth/active-role')
      .send({ role: 'employee' })
      .expect(403);

    expect(response.body.message).toContain('assigned');
  });
});
