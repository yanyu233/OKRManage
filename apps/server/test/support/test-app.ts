import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

export async function createTestApp(): Promise<INestApplication> {
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
