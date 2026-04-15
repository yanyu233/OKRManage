import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import JSZip = require('jszip');
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
    expect(uploadedProof.previewUrl).toContain('/api/internal/proofs/');
    expect(uploadedProof.downloadUrl).toBe(`/employee/proofs/${uploadedProof.id}/download`);
    expect(uploadedProof.fileUrl).toBe(uploadedProof.downloadUrl);

    const previewMeta = await employeeAgent.get(`/api/employee/proofs/${uploadedProof.id}/preview-meta`).expect(200);
    expect(previewMeta.body.mode).toBe('native');
    expect(previewMeta.body.fileName).toBe('quarter-proof.txt');
    expect(previewMeta.body.targetUrl).toContain(`/api/internal/proofs/${uploadedProof.id}/source`);
    expect(previewMeta.body.downloadUrl).toBe(`/employee/proofs/${uploadedProof.id}/download`);

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

  it('lists ZIP proof entries and previews extracted archive files through the project', async () => {
    const employeeAgent = await loginAsEmployee(app);
    const listResponse = await employeeAgent.get('/api/employee/okr?year=2026&quarter=1').expect(200);
    const goalId = listResponse.body.goals[0].id as string;
    const detail = await employeeAgent.get(`/api/employee/goals/${goalId}`).expect(200);
    const keyResult = detail.body.keyResults.find((entry: { code: string }) => entry.code === 'KR2');

    const archive = new JSZip();
    archive.file('附件目录/报告.docx', 'archived-docx-content');
    archive.file('附件目录/数据.xlsx', 'archived-xlsx-content');
    const archiveBuffer = await archive.generateAsync({ type: 'nodebuffer' });

    const uploadResponse = await employeeAgent
      .post(`/api/employee/key-results/${keyResult.id}/proofs`)
      .field('note', 'Archive preview regression case')
      .attach('file', archiveBuffer, 'archive-preview.zip')
      .expect(201);

    expect(uploadResponse.body.previewUrl).toContain('/proofs/archive/');

    const archivePreviewMeta = await employeeAgent.get(`/api/employee/proofs/${uploadResponse.body.id}/preview-meta`).expect(200);
    expect(archivePreviewMeta.body.mode).toBe('archive');
    expect(archivePreviewMeta.body.targetUrl).toContain(`/proofs/archive/${uploadResponse.body.id}`);

    const archiveManifest = await employeeAgent.get(`/api/employee/proofs/${uploadResponse.body.id}/archive`).expect(200);
    expect(archiveManifest.body.fileName).toBe('archive-preview.zip');
    expect(archiveManifest.body.entryCount).toBe(2);

    const docEntry = archiveManifest.body.entries.find((entry: { path: string }) => entry.path === '附件目录/报告.docx');
    const xlsxEntry = archiveManifest.body.entries.find((entry: { path: string }) => entry.path === '附件目录/数据.xlsx');
    expect(docEntry).toBeDefined();
    expect(xlsxEntry).toBeDefined();
    expect(docEntry.previewUrl).toContain(`/api/internal/proofs/${uploadResponse.body.id}/preview`);
    expect(docEntry.previewUrl).toContain('entryPath=');
    expect(xlsxEntry.previewUrl).toContain('/onlinePreview?');
    expect(docEntry.downloadUrl).toContain(`/employee/proofs/${uploadResponse.body.id}/archive/entry?`);

    const docPreviewMeta = await employeeAgent
      .get(`/api/employee/proofs/${uploadResponse.body.id}/preview-meta`)
      .query({
        entryPath: '附件目录/报告.docx'
      })
      .expect(200);
    expect(docPreviewMeta.body.mode).toBe('kkfileview');
    expect(docPreviewMeta.body.targetUrl).toContain('officePreviewType=pdf');
    expect(docPreviewMeta.body.fallbackUrl).toContain('/onlinePreview?');
    expect(docPreviewMeta.body.targetUrl).not.toContain('%253D');

    const xlsxPreviewMeta = await employeeAgent
      .get(`/api/employee/proofs/${uploadResponse.body.id}/preview-meta`)
      .query({
        entryPath: '附件目录/数据.xlsx'
      })
      .expect(200);
    expect(xlsxPreviewMeta.body.mode).toBe('kkfileview');
    expect(xlsxPreviewMeta.body.targetUrl).not.toContain('officePreviewType=pdf');
    expect(xlsxPreviewMeta.body.targetUrl).not.toContain('%253D');

    const previewSource = await request(app.getHttpServer())
      .get(`/api/internal/proofs/${uploadResponse.body.id}/source`)
      .query({
        accessToken: 'local-preview-token',
        entryPath: '附件目录/报告.docx',
        fullfilename: '报告.docx'
      })
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(previewSource.body.toString('utf8')).toContain('archived-docx-content');

    const leaderAgent = await loginAsSectionLeader(app);
    await leaderAgent.get(`/api/employee/proofs/${uploadResponse.body.id}/archive`).expect(200);

    const archiveDownload = await leaderAgent
      .get(`/api/employee/proofs/${uploadResponse.body.id}/archive/entry`)
      .query({
        entryPath: '附件目录/报告.docx'
      })
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(archiveDownload.body.toString('utf8')).toContain('archived-docx-content');
  });
});

function binaryParser(response: any, callback: (error: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
}
