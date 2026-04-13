import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee, loginAsSectionLeader } from './support/test-app';

describe('Employee proof upload', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('uploads a proof, returns it in detail, and allows leader download access', async () => {
    const employeeAgent = await loginAsEmployee(app);
    const listResponse = await employeeAgent.get('/api/employee/okr?year=2026&quarter=1').expect(200);
    const goalId = listResponse.body.goals[0].id as string;
    const detail = await employeeAgent.get(`/api/employee/goals/${goalId}`).expect(200);
    const keyResult = detail.body.keyResults.find((entry: { code: string }) => entry.code === 'KR2');

    await employeeAgent
      .post(`/api/employee/key-results/${keyResult.id}/proofs`)
      .field('note', 'Quarter acceptance record')
      .attach('file', Buffer.from('quarter-proof-content', 'utf8'), 'quarter-proof.txt')
      .expect(201);

    const refreshed = await employeeAgent.get(`/api/employee/goals/${goalId}`).expect(200);
    const refreshedKeyResult = refreshed.body.keyResults.find((entry: { id: string }) => entry.id === keyResult.id);
    const uploadedProof = refreshedKeyResult.proofs.find((entry: { fileName: string }) => entry.fileName === 'quarter-proof.txt');

    expect(uploadedProof).toBeDefined();
    expect(uploadedProof.previewUrl).toContain('/preview/onlinePreview?url=');
    expect(uploadedProof.downloadUrl).toBe(`/employee/proofs/${uploadedProof.id}/download`);
    expect(uploadedProof.fileUrl).toBe(uploadedProof.downloadUrl);

    const employeeDownload = await employeeAgent
      .get(`/api/employee/proofs/${uploadedProof.id}/download`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(employeeDownload.body.toString('utf8')).toContain('quarter-proof-content');

    const leaderAgent = await loginAsSectionLeader(app);
    await leaderAgent.get(`/api/employee/proofs/${uploadedProof.id}/download`).buffer(true).parse(binaryParser).expect(200);

    const previewSource = await request(app.getHttpServer())
      .get(`/api/internal/proofs/${uploadedProof.id}/source`)
      .query({
        accessToken: 'local-preview-token',
        fullfilename: 'quarter-proof.txt'
      })
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(previewSource.body.toString('utf8')).toContain('quarter-proof-content');
  });
});

function binaryParser(response: any, callback: (error: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
}
