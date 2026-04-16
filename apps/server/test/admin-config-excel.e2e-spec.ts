import { INestApplication } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSysadmin } from './support/test-app';

describe('Admin config excel import/export', () => {
  let app: INestApplication;
  const expectedSysadminName = process.env.DEBUG_SYSADMIN_NAME?.trim() || '严主任';

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('exports admin bootstrap as a workbook with expected sheets', async () => {
    const agent = await loginAsSysadmin(app);
    const response = await agent
      .get('/api/admin/org/bootstrap/excel')
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.body);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      '说明',
      '部门',
      '科室',
      '员工',
      '本地账号',
      '角色分配',
      '科室负责人绑定',
      '小组负责人绑定',
      '评价组',
      '评价组名额',
      '模板目标',
      '模板关键结果'
    ]);
    expect(workbook.getWorksheet('评价组名额')?.getRow(1).getCell(1).text).toContain('维护评价组档位名额');
    expect(workbook.getWorksheet('评价组名额')?.getRow(2).getCell(3).text).toBe('非负整数');
  });

  it('imports only edited review group quotas from workbook', async () => {
    const agent = await loginAsSysadmin(app);
    const exportResponse = await agent
      .get('/api/admin/org/bootstrap/excel')
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exportResponse.body);

    const quotaSheet = workbook.getWorksheet('评价组名额');
    expect(quotaSheet).toBeDefined();

    const infoGroupRow = quotaSheet!.getRows(4, quotaSheet!.rowCount - 3)?.find((row) => row.getCell(2).text === '信息化组');
    expect(infoGroupRow).toBeDefined();

    infoGroupRow!.getCell(3).value = 1; // A+
    infoGroupRow!.getCell(4).value = 1; // A
    infoGroupRow!.getCell(5).value = 1; // B
    infoGroupRow!.getCell(6).value = 0; // C
    infoGroupRow!.getCell(7).value = 0; // D

    const importBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await agent
      .post('/api/admin/org/bootstrap/excel')
      .attach('file', Buffer.from(importBuffer), 'admin-config.xlsx')
      .expect(200);

    const refreshed = await agent.get('/api/admin/org/bootstrap').expect(200);
    const targetGroup = refreshed.body.reviewGroups.find((entry: { name: string }) => entry.name === '信息化组');

    expect(targetGroup.quotas).toEqual([
      { gradeCode: 'A+', seatCount: 1 },
      { gradeCode: 'A', seatCount: 1 },
      { gradeCode: 'B', seatCount: 1 },
      { gradeCode: 'C', seatCount: 0 },
      { gradeCode: 'D', seatCount: 0 }
    ]);
  });

  it('exports and imports user position names in employee sheet', async () => {
    const agent = await loginAsSysadmin(app);
    const exportResponse = await agent
      .get('/api/admin/org/bootstrap/excel')
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exportResponse.body);

    const userSheet = workbook.getWorksheet('员工');
    expect(userSheet).toBeDefined();
    expect(userSheet!.getRow(3).getCell(4).text).toBe('岗位');

    const targetRow = userSheet!
      .getRows(4, userSheet!.rowCount - 3)
      ?.find((row) => row.getCell(2).text === 'EMP-0001');
    expect(targetRow).toBeDefined();

    targetRow!.getCell(4).value = '测试岗位';

    const importBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await agent
      .post('/api/admin/org/bootstrap/excel')
      .attach('file', Buffer.from(importBuffer), 'admin-config-users.xlsx')
      .expect(200);

    const refreshed = await agent.get('/api/admin/org/bootstrap').expect(200);
    const targetUser = refreshed.body.users.find((entry: { employeeNo: string }) => entry.employeeNo === 'EMP-0001');

    expect(targetUser.positionName).toBe('测试岗位');
  });

  it('imports an older exported workbook after ids change on reset', async () => {
    const firstAgent = await loginAsSysadmin(app);
    const exportResponse = await firstAgent
      .get('/api/admin/org/bootstrap/excel')
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    await app.close();
    await resetTestDatabase();
    app = await createTestApp();

    const secondAgent = await loginAsSysadmin(app);
    await secondAgent
      .post('/api/admin/org/bootstrap/excel')
      .attach('file', Buffer.from(exportResponse.body), 'admin-config-stale-ids.xlsx')
      .expect(200);

    const meResponse = await secondAgent.get('/api/me').expect(200);
    expect(meResponse.body.authenticated).toBe(true);
    expect(meResponse.body.user.name).toBe(expectedSysadminName);

    const bootstrapResponse = await secondAgent.get('/api/admin/org/bootstrap').expect(200);
    const sysadminUser = bootstrapResponse.body.users.find(
      (entry: { name: string }) => entry.name === expectedSysadminName
    );
    expect(sysadminUser).toBeDefined();
    expect(sysadminUser.isActive).toBe(true);
  }, 20000);

  it('rejects excel import when review group quotas exceed active member count', async () => {
    const agent = await loginAsSysadmin(app);
    const exportResponse = await agent
      .get('/api/admin/org/bootstrap/excel')
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exportResponse.body);

    const quotaSheet = workbook.getWorksheet('评价组名额');
    const infoGroupRow = quotaSheet!.getRows(4, quotaSheet!.rowCount - 3)?.find((row) => row.getCell(2).text === '信息化组');
    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);
    const targetGroup = bootstrap.body.reviewGroups.find((entry: { name: string }) => entry.name === '信息化组');

    infoGroupRow!.getCell(3).value = (targetGroup?.memberCount ?? 0) + 1;
    infoGroupRow!.getCell(4).value = 0;
    infoGroupRow!.getCell(5).value = 0;
    infoGroupRow!.getCell(6).value = 0;
    infoGroupRow!.getCell(7).value = 0;

    const importBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await agent
      .post('/api/admin/org/bootstrap/excel')
      .attach('file', Buffer.from(importBuffer), 'admin-config-invalid.xlsx')
      .expect(400);
  });

  it('ignores rows that only keep hidden helper ids but no visible template values', async () => {
    const agent = await loginAsSysadmin(app);
    const exportResponse = await agent
      .get('/api/admin/org/bootstrap/excel')
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exportResponse.body);

    const templateSheet = workbook.getWorksheet('模板目标');
    expect(templateSheet).toBeDefined();

    const newRow = templateSheet!.addRow([
      'template-hidden-only',
      'cmnvy7zog0000ijsgdg0k6zzs',
      '',
      '',
      '',
      ''
    ]);
    expect(newRow.number).toBeGreaterThan(4);

    const importBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await agent
      .post('/api/admin/org/bootstrap/excel')
      .attach('file', Buffer.from(importBuffer), 'admin-config-hidden-only.xlsx')
      .expect(200);
  });
});

function binaryParser(res: { on: (event: string, handler: (chunk?: unknown) => void) => void }, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];

  res.on('data', (chunk) =>
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  );
  res.on('end', () => callback(null, Buffer.concat(chunks)));
  res.on('error', (error) => callback(error as Error, Buffer.alloc(0)));
}
