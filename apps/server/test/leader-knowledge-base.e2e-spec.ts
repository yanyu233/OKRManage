import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee, loginAsGroupLeader, loginAsSectionLeader, loginAsSysadmin } from './support/test-app';

describe('Leader knowledge base permissions', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await closeTestDatabase();
  });

  it('allows in-scope section leaders to mark proofs as knowledge and edit the knowledge note', async () => {
    const sectionLeader = await loginAsSectionLeader(app);
    const proofId = await pickInScopeProofId(sectionLeader);

    const toggle = await sectionLeader
      .put(`/api/leader/proofs/${proofId}/knowledge`)
      .send({ isKnowledge: true })
      .expect(200);

    expect(toggle.body).toEqual(
      expect.objectContaining({
        id: proofId,
        isKnowledge: true,
        canManageKnowledge: true
      })
    );

    const knowledgeBase = await sectionLeader.get('/api/leader/knowledge-base').expect(200);
    const entry = knowledgeBase.body.entries.find((item: { id: string }) => item.id === proofId);

    expect(entry).toEqual(
      expect.objectContaining({
        id: proofId,
        isKnowledge: true,
        canManageKnowledge: true
      })
    );

    const update = await sectionLeader
      .put(`/api/leader/knowledge-base/${proofId}`)
      .field('note', 'section leader updated note')
      .expect(200);

    expect(update.body).toEqual(
      expect.objectContaining({
        id: proofId,
        note: 'section leader updated note',
        canManageKnowledge: true
      })
    );
  });

  it('rejects system admins from marking proofs as knowledge or editing knowledge files', async () => {
    const sectionLeader = await loginAsSectionLeader(app);
    const proofId = await pickInScopeProofId(sectionLeader);

    await sectionLeader
      .put(`/api/leader/proofs/${proofId}/knowledge`)
      .send({ isKnowledge: true })
      .expect(200);

    const sysadmin = await loginAsSysadmin(app);

    await sysadmin
      .put(`/api/leader/proofs/${proofId}/knowledge`)
      .send({ isKnowledge: false })
      .expect(403);

    await sysadmin
      .put(`/api/leader/knowledge-base/${proofId}`)
      .field('note', 'sysadmin should not edit')
      .expect(403);

    await sysadmin
      .post('/api/leader/knowledge-base/manual-assets')
      .attach('file', Buffer.from('sysadmin-manual-knowledge', 'utf8'), {
        filename: 'sysadmin-manual.txt',
        contentType: 'text/plain'
      })
      .expect(403);
  });

  it('rejects section leaders when the proof is outside their knowledge scope', async () => {
    const sectionLeader = await loginAsSectionLeader(app);
    const outOfScopeProofId = await pickOutOfScopeProofId(sectionLeader);

    await sectionLeader
      .put(`/api/leader/proofs/${outOfScopeProofId}/knowledge`)
      .send({ isKnowledge: true })
      .expect(403);
  });

  it('allows section leaders and group leaders to upload manual knowledge files and update them later', async () => {
    const sectionLeader = await loginAsSectionLeader(app);
    const upload = await sectionLeader
      .post('/api/leader/knowledge-base/manual-assets')
      .field('note', 'section leader manual knowledge')
      .attach('file', Buffer.from('section-manual-knowledge', 'utf8'), {
        filename: 'section-manual.txt',
        contentType: 'text/plain'
      })
      .expect(201);

    expect(upload.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        entryType: 'manual',
        canManageKnowledge: true,
        employeeId: null,
        goalId: null,
        keyResultId: null,
        note: 'section leader manual knowledge'
      })
    );

    const knowledgeBase = await sectionLeader.get('/api/leader/knowledge-base').expect(200);
    const uploadedEntry = knowledgeBase.body.entries.find((entry: { id: string }) => entry.id === upload.body.id);
    expect(uploadedEntry).toEqual(
      expect.objectContaining({
        entryType: 'manual',
        uploaderName: expect.any(String)
      })
    );

    const update = await sectionLeader
      .put(`/api/leader/knowledge-base/manual-assets/${upload.body.id}`)
      .field('note', 'section leader manual knowledge updated')
      .expect(200);

    expect(update.body).toEqual(
      expect.objectContaining({
        id: upload.body.id,
        entryType: 'manual',
        note: 'section leader manual knowledge updated'
      })
    );

    const groupLeader = await loginAsGroupLeader(app);
    await groupLeader
      .post('/api/leader/knowledge-base/manual-assets')
      .field('note', 'group leader manual knowledge')
      .attach('file', Buffer.from('group-manual-knowledge', 'utf8'), {
        filename: 'group-manual.txt',
        contentType: 'text/plain'
      })
      .expect(201);
  });

  it('allows the uploader to update a manual knowledge file after switching away from the leader role', async () => {
    const groupLeader = await loginAsGroupLeader(app);
    const upload = await groupLeader
      .post('/api/leader/knowledge-base/manual-assets')
      .field('note', 'group leader own manual knowledge')
      .attach('file', Buffer.from('group-leader-own-manual-knowledge', 'utf8'), {
        filename: 'group-leader-own-manual.txt',
        contentType: 'text/plain'
      })
      .expect(201);

    await groupLeader
      .post('/api/auth/active-role')
      .send({ role: 'employee' })
      .expect(200);

    const knowledgeBase = await groupLeader.get('/api/leader/knowledge-base').expect(200);
    const ownEntry = knowledgeBase.body.entries.find((entry: { id: string }) => entry.id === upload.body.id);
    expect(ownEntry).toEqual(
      expect.objectContaining({
        id: upload.body.id,
        entryType: 'manual',
        canManageKnowledge: true
      })
    );

    await groupLeader
      .put(`/api/leader/knowledge-base/manual-assets/${upload.body.id}`)
      .field('note', 'group leader own manual knowledge updated as employee')
      .expect(200);
  });

  it('returns a downloadable zip for knowledge bulk download', async () => {
    const employee = await loginAsEmployee(app);
    const employeeOkr = await employee.get('/api/employee/okr?year=2026&quarter=1').expect(200);
    const employeeGoalId = employeeOkr.body.goals[0].id as string;
    const employeeGoalDetail = await employee.get(`/api/employee/goals/${employeeGoalId}`).expect(200);
    const uploadTargetKr = employeeGoalDetail.body.keyResults.find(
      (entry: { hasProofs: boolean }) => !entry.hasProofs
    );

    const inScopeUpload = await employee
      .post(`/api/employee/key-results/${uploadTargetKr.id}/proofs`)
      .field('note', 'knowledge download check')
      .attach('file', Buffer.from('knowledge-download-content', 'utf8'), {
        filename: 'knowledge-download.txt',
        contentType: 'text/plain'
      })
      .expect(201);

    const sectionLeader = await loginAsSectionLeader(app);
    const inScopeProofId = inScopeUpload.body.id as string;

    await sectionLeader
      .put(`/api/leader/proofs/${inScopeProofId}/knowledge`)
      .send({ isKnowledge: true })
      .expect(200);

    const manualUpload = await sectionLeader
      .post('/api/leader/knowledge-base/manual-assets')
      .field('note', 'manual knowledge in bulk download')
      .attach('file', Buffer.from('manual-knowledge-download', 'utf8'), {
        filename: 'manual-knowledge.txt',
        contentType: 'text/plain'
      })
      .expect(201);

    const knowledgeBase = await sectionLeader.get('/api/leader/knowledge-base').expect(200);
    const knowledgeEntry = knowledgeBase.body.entries.find((entry: { id: string }) => entry.id === inScopeProofId);
    const downloadProofId = knowledgeEntry?.entryKey as string;

    expect(downloadProofId).toBeDefined();

    const download = await sectionLeader
      .post('/api/leader/knowledge-base/download')
      .send({ proofIds: [downloadProofId, manualUpload.body.entryKey] })
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(download.headers['content-type']).toContain('application/zip');
    expect(download.headers['content-disposition']).toContain('.zip');
    expect(download.body.slice(0, 2).toString('utf8')).toBe('PK');
  });
});

async function pickInScopeProofId(agent: any) {
  const workbench = await agent.get('/api/leader/workbench?year=2026&quarter=1').expect(200);
  const employee = workbench.body.employees.find(
    (entry: { canScore: boolean; proofCount: number }) => entry.canScore && entry.proofCount > 0
  );

  const goalSummary = employee
    ? workbench.body.bulkCatalog
        .find((entry: { id: string }) => entry.id === employee.id)
        ?.goals.find((entry: { keyResults: Array<{ proofCount: number }> }) =>
          entry.keyResults.some((keyResult) => keyResult.proofCount > 0)
        )
    : null;

  const detail = await agent
    .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${employee.id}&goalId=${goalSummary.id}`)
    .expect(200);
  const goal = detail.body.selectedGoal;
  const keyResult = goal.keyResults.find((entry: { proofs: Array<unknown> }) => entry.proofs.length > 0);

  return keyResult.proofs[0].id as string;
}

async function pickOutOfScopeProofId(agent: any) {
  const workbench = await agent.get('/api/leader/workbench?year=2026&quarter=1').expect(200);
  const employee = workbench.body.employees.find(
    (entry: { canScore: boolean; proofCount: number }) => !entry.canScore && entry.proofCount > 0
  );

  const goalSummary = employee
    ? workbench.body.bulkCatalog
        .find((entry: { id: string }) => entry.id === employee.id)
        ?.goals.find((entry: { keyResults: Array<{ proofCount: number }> }) =>
          entry.keyResults.some((keyResult) => keyResult.proofCount > 0)
        )
    : null;

  const detail = await agent
    .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${employee.id}&goalId=${goalSummary.id}`)
    .expect(200);
  const goal = detail.body.selectedGoal;
  const keyResult = goal.keyResults.find((entry: { proofs: Array<unknown> }) => entry.proofs.length > 0);

  return keyResult.proofs[0].id as string;
}

function binaryParser(response: any, callback: (error: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
}
