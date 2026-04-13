import { INestApplication } from '@nestjs/common';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee, loginAsSectionLeader } from './support/test-app';

describe('Leader workbench', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('returns all employees for leaders, keeps out-of-scope users readonly, and exposes bulk preview catalog', async () => {
    const employee = await loginAsEmployee(app);
    const templates = await employee.get('/api/employee/goal-templates?year=2026&quarter=1').expect(200);
    await employee
      .post('/api/employee/goal-templates/import')
      .send({
        year: 2026,
        quarter: 1,
        templateIds: [templates.body.templates[0].id]
      })
      .expect(201);

    const agent = await loginAsSectionLeader(app);
    const response = await agent.get('/api/leader/workbench?year=2026&quarter=1').expect(200);
    const zhang = response.body.employees.find((entry: { name: string }) => entry.name === '张晨');
    const liLei = response.body.employees.find((entry: { name: string }) => entry.name === '李雷');

    expect(response.body.employees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '张晨',
          canScore: true
        }),
        expect.objectContaining({
          name: '王敏',
          canScore: true
        }),
        expect.objectContaining({
          name: '李雷',
          canScore: false
        })
      ])
    );
    expect(zhang).toBeTruthy();
    expect(liLei).toBeTruthy();

    const selectedResponse = await agent
      .get(`/api/leader/workbench?year=2026&quarter=1&employeeId=${liLei.id}`)
      .expect(200);

    expect(selectedResponse.body.selectedEmployee).toEqual(
      expect.objectContaining({
        name: '李雷',
        canScore: false
      })
    );
    expect(selectedResponse.body.goals[0]).toEqual(
      expect.objectContaining({
        canScore: false
      })
    );
    expect(selectedResponse.body.selectedGoal.keyResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'KR1',
          canScore: false
        })
      ])
    );

    expect(response.body.bulkCatalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: zhang.id,
          name: '张晨',
          goals: expect.arrayContaining([
            expect.objectContaining({
              isTemplateGoal: true,
              keyResults: expect.arrayContaining([
                expect.objectContaining({
                  scoreType: expect.any(String)
                })
              ])
            })
          ])
        })
      ])
    );
  });
});
