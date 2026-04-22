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

  it('auto-advances confirmed past-quarter goals into pending review', async () => {
    const admin = await loginAsSysadmin(app);
    const employee = await loginAsEmployee(app);

    const elapsedYear = 2024;
    const elapsedQuarter = 1;
    const created = await employee
      .post('/api/employee/goals')
      .send({
        year: elapsedYear,
        quarter: elapsedQuarter,
        name: 'Elapsed quarter auto transition',
        description: 'Used to verify automatic pending-review transition after confirmation',
        keyResults: [
          {
            code: 'KR1',
            name: 'Elapsed KR',
            description: null,
            points: 10
          }
        ]
      })
      .expect(201);

    const employeeId = created.body.owner.id as string;
    const confirmElapsedGoal = await admin
      .post('/api/admin/goal-status-control/transition')
      .send({
        year: elapsedYear,
        quarter: elapsedQuarter,
        userId: employeeId,
        targetStatus: 'confirmed'
      })
      .expect(200);

    expect(confirmElapsedGoal.body.affectedGoalCount).toBeGreaterThan(0);
    expect(confirmElapsedGoal.body.autoAdvancedGoalCount).toBeGreaterThan(0);

    const afterTransition = await admin
      .get(`/api/admin/goal-status-control?year=${elapsedYear}&quarter=${elapsedQuarter}&userId=${employeeId}`)
      .expect(200);

    expect(afterTransition.body.records.length).toBeGreaterThan(0);
    expect(afterTransition.body.records.every((entry: { status: string }) => entry.status === 'pending-review')).toBe(true);
  });

  it('allows system admins to configure employees who do not participate in a quarter', async () => {
    const admin = await loginAsSysadmin(app);
    const employee = await loginAsEmployee(app);

    const created = await employee
      .post('/api/employee/goals')
      .send({
        year: 2029,
        quarter: 1,
        name: 'Quarter exclusion target',
        description: 'Used to verify quarter participation exclusions',
        keyResults: [
          {
            code: 'KR1',
            name: 'Quarter exclusion KR',
            description: null,
            points: 10
          }
        ]
      })
      .expect(201);

    const employeeId = created.body.owner.id as string;
    const employeeName = created.body.owner.name as string;

    const saved = await admin
      .put('/api/admin/quarter-participation-exclusions')
      .send({
        year: 2029,
        quarter: 1,
        userIds: [employeeId]
      })
      .expect(200);

    expect(saved.body.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: employeeId,
          userName: employeeName
        })
      ])
    );

    const fetched = await admin
      .get('/api/admin/quarter-participation-exclusions?year=2029&quarter=1')
      .expect(200);

    expect(fetched.body.records).toHaveLength(1);
    expect(fetched.body.records[0]).toEqual(
      expect.objectContaining({
        userId: employeeId,
        userName: employeeName
      })
    );
  });
});
