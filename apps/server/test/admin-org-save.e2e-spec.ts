import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSysadmin } from './support/test-app';

describe('Admin org bootstrap save', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('saves an organization snapshot and returns it from bootstrap', async () => {
    const agent = await loginAsSysadmin(app);
    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);

    await agent
      .put('/api/admin/org/bootstrap')
      .send({
        ...bootstrap.body,
        departments: [
          ...bootstrap.body.departments,
          {
            id: 'dept-new',
            name: 'New Department',
            isActive: true
          }
        ]
      })
      .expect(200);

    const refreshed = await agent.get('/api/admin/org/bootstrap').expect(200);
    expect(refreshed.body.departments.some((entry: { name: string }) => entry.name === 'New Department')).toBe(true);
  });

  it('hides deleted goal templates from bootstrap after save', async () => {
    const agent = await loginAsSysadmin(app);
    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);

    expect(bootstrap.body.goalTemplates.length).toBeGreaterThan(0);

    const deletedTemplate = bootstrap.body.goalTemplates[0];

    await agent
      .put('/api/admin/org/bootstrap')
      .send({
        ...bootstrap.body,
        goalTemplates: bootstrap.body.goalTemplates.filter((entry: { id: string }) => entry.id !== deletedTemplate.id)
      })
      .expect(200);

    const refreshed = await agent.get('/api/admin/org/bootstrap').expect(200);

    expect(refreshed.body.goalTemplates.find((entry: { id: string }) => entry.id === deletedTemplate.id)).toBeUndefined();
  });

  it('derives role scopes automatically when saving bootstrap', async () => {
    const agent = await loginAsSysadmin(app);
    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);
    const employeeAssignment = bootstrap.body.roleAssignments.find(
      (entry: { roleCode: string; userId: string }) => entry.roleCode === 'employee' && entry.userId !== 'user-sysadmin'
    );

    expect(employeeAssignment).toBeDefined();

    await agent
      .put('/api/admin/org/bootstrap')
      .send({
        ...bootstrap.body,
        roleAssignments: bootstrap.body.roleAssignments.map((entry: { id: string }) =>
          entry.id === employeeAssignment.id
            ? {
                ...entry,
                roleCode: 'employee',
                scopeType: '',
                scopeId: ''
              }
            : entry
        )
      })
      .expect(200);

    const refreshed = await agent.get('/api/admin/org/bootstrap').expect(200);
    const updatedAssignment = refreshed.body.roleAssignments.find((entry: { id: string }) => entry.id === employeeAssignment.id);

    expect(updatedAssignment.scopeType).toBe('user');
    expect(updatedAssignment.scopeId).toBe(updatedAssignment.userId);
  });

  it('normalizes invalid template points instead of blocking unrelated saves', async () => {
    const agent = await loginAsSysadmin(app);
    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);
    const roleAssignment = bootstrap.body.roleAssignments[0];
    const goalTemplate = bootstrap.body.goalTemplates[0];

    await agent
      .put('/api/admin/org/bootstrap')
      .send({
        ...bootstrap.body,
        roleAssignments: bootstrap.body.roleAssignments.map((entry: { id: string; isPrimary: boolean }) =>
          entry.id === roleAssignment.id
            ? {
                ...entry,
                isPrimary: !entry.isPrimary
              }
            : entry
        ),
        goalTemplates: [
          {
            ...goalTemplate,
            keyResults: goalTemplate.keyResults.map((entry: { id: string }) =>
              entry.id === goalTemplate.keyResults[0].id
                ? {
                    ...entry,
                    points: 'invalid'
                  }
                : entry
            )
          }
        ]
      })
      .expect(200);

    const refreshed = await agent.get('/api/admin/org/bootstrap').expect(200);
    const refreshedTemplate = refreshed.body.goalTemplates.find((entry: { id: string }) => entry.id === goalTemplate.id);

    expect(refreshedTemplate.keyResults[0].points).toBe(0);
  });

  it('persists review group quotas through bootstrap save', async () => {
    const agent = await loginAsSysadmin(app);
    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);
    const targetGroup = bootstrap.body.reviewGroups.find(
      (entry: { name: string }) => entry.name === '\u4fe1\u606f\u5316\u7ec4'
    );

    expect(targetGroup).toBeDefined();

    await agent
      .put('/api/admin/org/bootstrap')
      .send({
        ...bootstrap.body,
        reviewGroups: bootstrap.body.reviewGroups.map(
          (entry: { id: string; quotas: Array<{ gradeCode: string; seatCount: number }> }) =>
            entry.id === targetGroup.id
              ? {
                  ...entry,
                  quotas: [
                    { gradeCode: 'A+', seatCount: 1 },
                    { gradeCode: 'A', seatCount: 1 },
                    { gradeCode: 'B', seatCount: 1 },
                    { gradeCode: 'C', seatCount: 0 },
                    { gradeCode: 'D', seatCount: 0 }
                  ]
                }
              : entry
        )
      })
      .expect(200);

    const refreshed = await agent.get('/api/admin/org/bootstrap').expect(200);
    const refreshedGroup = refreshed.body.reviewGroups.find((entry: { id: string }) => entry.id === targetGroup.id);

    expect(refreshedGroup.quotas).toEqual([
      { gradeCode: 'A+', seatCount: 1 },
      { gradeCode: 'A', seatCount: 1 },
      { gradeCode: 'B', seatCount: 1 },
      { gradeCode: 'C', seatCount: 0 },
      { gradeCode: 'D', seatCount: 0 }
    ]);
  });

  it('persists user position name through bootstrap save', async () => {
    const agent = await loginAsSysadmin(app);
    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);
    const targetUser = bootstrap.body.users.find((entry: { employeeNo: string }) => entry.employeeNo === 'EMP-0001');

    expect(targetUser).toBeDefined();

    await agent
      .put('/api/admin/org/bootstrap')
      .send({
        ...bootstrap.body,
        users: bootstrap.body.users.map((entry: { id: string }) =>
          entry.id === targetUser.id
            ? {
                ...entry,
                positionName: '架构工程师'
              }
            : entry
        )
      })
      .expect(200);

    const refreshed = await agent.get('/api/admin/org/bootstrap').expect(200);
    const refreshedUser = refreshed.body.users.find((entry: { id: string }) => entry.id === targetUser.id);

    expect(refreshedUser.positionName).toBe('架构工程师');
  });

  it('rejects bootstrap review group quotas when total seats exceed active member count', async () => {
    const agent = await loginAsSysadmin(app);
    const bootstrap = await agent.get('/api/admin/org/bootstrap').expect(200);
    const targetGroup = bootstrap.body.reviewGroups.find(
      (entry: { name: string }) => entry.name === '\u4fe1\u606f\u5316\u7ec4'
    );

    expect(targetGroup).toBeDefined();

    await agent
      .put('/api/admin/org/bootstrap')
      .send({
        ...bootstrap.body,
        reviewGroups: bootstrap.body.reviewGroups.map(
          (entry: { id: string; memberCount: number; quotas: Array<{ gradeCode: string; seatCount: number }> }) =>
            entry.id === targetGroup.id
              ? {
                  ...entry,
                  quotas: [
                    { gradeCode: 'A+', seatCount: entry.memberCount + 1 },
                    { gradeCode: 'A', seatCount: 0 },
                    { gradeCode: 'B', seatCount: 0 },
                    { gradeCode: 'C', seatCount: 0 },
                    { gradeCode: 'D', seatCount: 0 }
                  ]
                }
              : entry
        )
      })
      .expect(400);
  });
});
