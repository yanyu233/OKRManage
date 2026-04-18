import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

const SYSADMIN_LOGIN = 'sysadmin.local';
const DEFAULT_TEST_PASSWORD = 'Admin123!';
const MULTI_ROLE_LOGIN = '1700066';

export async function createTestApp(): Promise<INestApplication> {
  process.env.APP_BASE_URL ??= 'http://127.0.0.1:3000';
  process.env.WEB_BASE_URL ??= 'http://127.0.0.1:5173';
  process.env.KKFILEVIEW_PUBLIC_BASE_URL ??= 'http://127.0.0.1:3000/preview';
  process.env.KKFILEVIEW_SOURCE_BASE_URL ??= 'http://127.0.0.1:3000';
  process.env.KKFILEVIEW_PREVIEW_TOKEN ??= 'local-preview-token';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

export async function loginAsSysadmin(app: INestApplication) {
  const agent = request.agent(app.getHttpServer());

  await agent.post('/api/auth/manual-login').send({
    loginName: SYSADMIN_LOGIN,
    password: DEFAULT_TEST_PASSWORD
  }).expect(200);

  return agent;
}

export async function loginAsSectionLeader(app: INestApplication) {
  const agent = await loginAsCurrentDemoUser(app);
  await switchActiveRole(agent, 'section-leader');
  return agent;
}

export async function loginAsEmployee(app: INestApplication) {
  const agent = await loginAsCurrentDemoUser(app);
  await switchActiveRole(agent, 'employee');
  return agent;
}

export async function loginAsGroupLeader(app: INestApplication) {
  const agent = await loginAsCurrentDemoUser(app);
  await switchActiveRole(agent, 'group-leader');
  return agent;
}

async function loginAsCurrentDemoUser(app: INestApplication) {
  const agent = request.agent(app.getHttpServer());

  await agent.post('/api/auth/manual-login').send({
    loginName: MULTI_ROLE_LOGIN,
    password: DEFAULT_TEST_PASSWORD
  }).expect(200);

  return agent;
}

async function switchActiveRole(agent: any, role: 'employee' | 'group-leader' | 'section-leader') {
  await agent.post('/api/auth/active-role').send({ role }).expect(200);
}
