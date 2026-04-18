import { INestApplication } from '@nestjs/common';
import * as JSZip from 'jszip';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSectionLeader } from './support/test-app';
import { CURRENT_DEMO_EMPLOYEES, CURRENT_DEMO_PUBLIC_NOTICE } from './support/current-demo-data';

describe('Leader public notice export', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
    await closeTestDatabase();
  });

  it('exports quarterly public notice as a docx document', async () => {
    const agent = await loginAsSectionLeader(app);
    const response = await agent
      .get('/api/leader/ranking/public-notice?year=2026&quarter=1')
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(response.headers['content-disposition']).toContain('.docx');

    const documentXml = await readWordDocumentXml(response.body);
    expect(documentXml).toContain(CURRENT_DEMO_PUBLIC_NOTICE.quarterlyTitle);
    expect(documentXml).toContain('部门内绩效考核等级');
    expect(documentXml).toContain(CURRENT_DEMO_EMPLOYEES.employeeLeader.name);
    expect(documentXml).toContain('1700066');
    expect(documentXml).toContain('负责人');
    expect(documentXml).toContain(CURRENT_DEMO_EMPLOYEES.topRankEmployee.name);
    expect(documentXml).toContain('A+');
    expect(documentXml).toContain('A');
  });

  it('exports annual public notice as a docx document', async () => {
    const agent = await loginAsSectionLeader(app);
    const response = await agent
      .get('/api/leader/annual-ranking/public-notice?year=2026')
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    const documentXml = await readWordDocumentXml(response.body);
    expect(documentXml).toContain(CURRENT_DEMO_PUBLIC_NOTICE.annualTitle);
    expect(documentXml).toContain(CURRENT_DEMO_EMPLOYEES.topRankEmployee.name);
    expect(documentXml).toContain(CURRENT_DEMO_EMPLOYEES.employeeLeader.name);
    expect(documentXml).toContain('1700066');
    expect(documentXml).toContain('负责人');
    expect(documentXml).toContain('A+');
  });
});

async function readWordDocumentXml(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const documentXmlFile = zip.file('word/document.xml');

  if (!documentXmlFile) {
    throw new Error('word/document.xml not found');
  }

  return documentXmlFile.async('string');
}

function binaryParser(
  res: { on: (event: string, handler: (chunk?: unknown) => void) => void },
  callback: (err: Error | null, body: Buffer) => void
) {
  const chunks: Buffer[] = [];

  res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
  res.on('error', (error) => callback(error as Error, Buffer.alloc(0)));
}
