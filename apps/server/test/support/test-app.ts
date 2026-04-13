import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

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
    loginName: 'sysadmin.local',
    password: 'Admin123!'
  }).expect(200);

  return agent;
}

export async function loginAsSectionLeader(app: INestApplication) {
  const agent = request.agent(app.getHttpServer());

  await agent.post('/api/auth/manual-login').send({
    loginName: 'section.leader',
    password: 'Leader123!'
  }).expect(200);

  return agent;
}

export async function loginAsEmployee(app: INestApplication) {
  const agent = request.agent(app.getHttpServer());

  await agent.post('/api/auth/manual-login').send({
    loginName: 'zhang.chen',
    password: 'Employee123!'
  }).expect(200);

  return agent;
}

export async function loginAsGroupLeader(app: INestApplication) {
  const agent = request.agent(app.getHttpServer());

  await agent.post('/api/auth/manual-login').send({
    loginName: 'group.leader',
    password: 'Leader123!'
  }).expect(200);

  return agent;
}
