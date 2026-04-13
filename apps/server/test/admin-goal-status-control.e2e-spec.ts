import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee, loginAsSysadmin } from './support/test-app';

describe('Admin goal status control', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('confirms quarter goals in bulk and can reopen a single employee back to draft', async () => {
    const employee = await loginAsEmployee(app);
    const employeeQuarter = await employee.get('/api/employee/okr?year=2026&quarter=1').expect(200);
    const employeeId = employeeQuarter.body.employee.id as string;
    await employee
      .post('/api/employee/goals')
      .send({
        year: 2026,
        quarter: 1,
        name: 'Admin status control draft',
        description: 'Created for admin status transition',
        keyResults: [
          {
            code: 'KR1',
            name: 'Draft KR',
            description: null,
            points: 10
          }
        ]
      })
      .expect(201);

    const admin = await loginAsSysadmin(app);

    const before = await admin.get('/api/admin/goal-status-control?year=2026&quarter=1').expect(200);
    expect(before.body.records.some((entry: { status: string }) => entry.status === 'draft')).toBe(true);

    const confirmAll = await admin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: 2026,
        quarter: 1,
        targetStatus: 'confirmed'
      })
      .expect(200);

    expect(confirmAll.body.affectedGoalCount).toBeGreaterThan(0);

    const afterConfirm = await admin.get('/api/admin/goal-status-control?year=2026&quarter=1').expect(200);
    expect(afterConfirm.body.records.every((entry: { status: string }) => entry.status === 'confirmed')).toBe(true);

    const reopenOne = await admin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: 2026,
        quarter: 1,
        userId: employeeId,
        targetStatus: 'draft'
      })
      .expect(200);

    expect(reopenOne.body.affectedGoalCount).toBeGreaterThan(0);

    const afterReopen = await admin
      .get(`/api/admin/goal-status-control?year=2026&quarter=1&userId=${employeeId}`)
      .expect(200);

    expect(afterReopen.body.records.length).toBeGreaterThan(0);
    expect(afterReopen.body.records.every((entry: { ownerUserId: string; status: string }) => entry.ownerUserId === employeeId)).toBe(true);
    expect(afterReopen.body.records.every((entry: { status: string }) => entry.status === 'draft')).toBe(true);
  });
});
