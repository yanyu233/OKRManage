import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('Manual debug login', () => {
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

  it('creates a session for allowed local-debug users', async () => {
    const agent = request.agent(app.getHttpServer());

    const login = await agent.post('/api/auth/manual-login').send({
      loginName: 'sysadmin.local',
      password: 'Admin123!'
    }).expect(200);

    expect(login.body.ok).toBe(true);
    expect(login.body.user.id).toBeDefined();

    const me = await agent.get('/api/me').expect(200);
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user.loginName).toBe('sysadmin.local');
  });
});
