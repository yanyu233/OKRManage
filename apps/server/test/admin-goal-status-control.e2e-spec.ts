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
    if (app) {
      await app.close();
    }
    await closeTestDatabase();
  });

  it('confirms quarter goals in bulk and can reopen a single employee back to draft', async () => {
    const editableYear = 2028;
    const editableQuarter = 1;
    const employee = await loginAsEmployee(app);
    const created = await employee
      .post('/api/employee/goals')
      .send({
        year: editableYear,
        quarter: editableQuarter,
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

    const employeeId = created.body.owner.id as string;
    const admin = await loginAsSysadmin(app);

    const before = await admin.get(`/api/admin/goal-status-control?year=${editableYear}&quarter=${editableQuarter}`).expect(200);
    expect(before.body.records.some((entry: { status: string }) => entry.status === 'draft')).toBe(true);

    const confirmAll = await admin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: editableYear,
        quarter: editableQuarter,
        targetStatus: 'confirmed'
      })
      .expect(200);

    expect(confirmAll.body.affectedGoalCount).toBeGreaterThan(0);

    const afterConfirm = await admin.get(`/api/admin/goal-status-control?year=${editableYear}&quarter=${editableQuarter}`).expect(200);
    expect(afterConfirm.body.records.length).toBeGreaterThan(0);
    expect(afterConfirm.body.records.every((entry: { status: string }) => entry.status === 'confirmed')).toBe(true);

    const reopenOne = await admin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: editableYear,
        quarter: editableQuarter,
        userId: employeeId,
        targetStatus: 'draft'
      })
      .expect(200);

    expect(reopenOne.body.affectedGoalCount).toBeGreaterThan(0);

    const afterReopen = await admin
      .get(`/api/admin/goal-status-control?year=${editableYear}&quarter=${editableQuarter}&userId=${employeeId}`)
      .expect(200);

    expect(afterReopen.body.records.length).toBeGreaterThan(0);
    expect(afterReopen.body.records.every((entry: { ownerUserId: string; status: string }) => entry.ownerUserId === employeeId)).toBe(true);
    expect(afterReopen.body.records.every((entry: { status: string }) => entry.status === 'draft')).toBe(true);
  });

  it('allows admins to manually move draft or confirmed goals to pending review', async () => {
    const admin = await loginAsSysadmin(app);
    const employee = await loginAsEmployee(app);

    const draftYear = 2028;
    const draftQuarter = 2;
    const draftCreated = await employee
      .post('/api/employee/goals')
      .send({
        year: draftYear,
        quarter: draftQuarter,
        name: 'Manual pending-review from draft',
        description: 'Draft goal for manual pending-review fallback',
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

    const employeeId = draftCreated.body.owner.id as string;

    const moveDraftToPendingReview = await admin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: draftYear,
        quarter: draftQuarter,
        userId: employeeId,
        targetStatus: 'pending-review'
      })
      .expect(200);

    expect(moveDraftToPendingReview.body.affectedGoalCount).toBeGreaterThan(0);

    const afterDraftMove = await admin
      .get(`/api/admin/goal-status-control?year=${draftYear}&quarter=${draftQuarter}&userId=${employeeId}`)
      .expect(200);

    expect(afterDraftMove.body.records.length).toBeGreaterThan(0);
    expect(afterDraftMove.body.records.every((entry: { status: string }) => entry.status === 'pending-review')).toBe(true);

    const confirmedYear = 2028;
    const confirmedQuarter = 3;
    await employee
      .post('/api/employee/goals')
      .send({
        year: confirmedYear,
        quarter: confirmedQuarter,
        name: 'Manual pending-review from confirmed',
        description: 'Confirmed goal for manual pending-review fallback',
        keyResults: [
          {
            code: 'KR1',
            name: 'Confirmed KR',
            description: null,
            points: 10
          }
        ]
      })
      .expect(201);

    const confirmGoal = await admin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: confirmedYear,
        quarter: confirmedQuarter,
        userId: employeeId,
        targetStatus: 'confirmed'
      })
      .expect(200);

    expect(confirmGoal.body.affectedGoalCount).toBeGreaterThan(0);

    const moveConfirmedToPendingReview = await admin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: confirmedYear,
        quarter: confirmedQuarter,
        userId: employeeId,
        targetStatus: 'pending-review'
      })
      .expect(200);

    expect(moveConfirmedToPendingReview.body.affectedGoalCount).toBeGreaterThan(0);

    const afterConfirmedMove = await admin
      .get(`/api/admin/goal-status-control?year=${confirmedYear}&quarter=${confirmedQuarter}&userId=${employeeId}`)
      .expect(200);

    expect(afterConfirmedMove.body.records.length).toBeGreaterThan(0);
    expect(afterConfirmedMove.body.records.every((entry: { status: string }) => entry.status === 'pending-review')).toBe(true);
  });
});
