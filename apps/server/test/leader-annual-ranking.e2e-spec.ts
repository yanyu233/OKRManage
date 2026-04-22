import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsSectionLeader, loginAsSysadmin } from './support/test-app';
import { CURRENT_DEMO_EMPLOYEES } from './support/current-demo-data';

describe('Leader annual ranking', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    await resetTestDatabase();
    process.env.DATABASE_URL = process.env.OKR_E2E_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
    prisma = new PrismaClient();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await closeTestDatabase();
  });

  it('hides annual scores for non-system-admins until all published quarters are fully scored', async () => {
    const agent = await loginAsSectionLeader(app);
    const response = await agent.get('/api/leader/annual-ranking?year=2026').expect(200);

    expect(response.body.scoresVisible).toBe(false);
    expect(response.body.ranking.length).toBeGreaterThan(0);
    expect(
      response.body.ranking.every(
        (entry: {
          annualScore: number | null;
          quarterScores: Array<{ quarter: number; score: number | null }>;
        }) => entry.annualScore === null && entry.quarterScores.every((item) => item.score === null)
      )
    ).toBe(true);
    expect(response.body.selectedEmployee).toEqual(
      expect.objectContaining({
        annualScore: null
      })
    );
  });

  it('returns annual scores to system admins on the current demo baseline', async () => {
    const agent = await loginAsSysadmin(app);
    const response = await agent.get('/api/leader/annual-ranking?year=2026').expect(200);

    expect(response.body.scoresVisible).toBe(true);
    expect(response.body.ranking[0]).toEqual(
      expect.objectContaining({
        employeeName: CURRENT_DEMO_EMPLOYEES.topRankEmployee.name,
        annualScore: CURRENT_DEMO_EMPLOYEES.topRankEmployee.annualScore,
        quarterScores: CURRENT_DEMO_EMPLOYEES.topRankEmployee.quarterScores
      })
    );

    expect(response.body.ranking).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeName: CURRENT_DEMO_EMPLOYEES.employeeLeader.name,
          annualScore: CURRENT_DEMO_EMPLOYEES.employeeLeader.annualScore,
          quarterScores: [
            { quarter: 1, score: 58 },
            { quarter: 2, score: 72 },
            { quarter: 3, score: 0 },
            { quarter: 4, score: 0 }
          ]
        }),
        expect.objectContaining({
          employeeName: CURRENT_DEMO_EMPLOYEES.secondRankEmployee.name,
          annualScore: CURRENT_DEMO_EMPLOYEES.secondRankEmployee.annualScore,
          quarterScores: CURRENT_DEMO_EMPLOYEES.secondRankEmployee.quarterScores
        }),
        expect.objectContaining({
          employeeName: CURRENT_DEMO_EMPLOYEES.outOfScopeEmployee.name,
          annualScore: CURRENT_DEMO_EMPLOYEES.outOfScopeEmployee.annualScore,
          quarterScores: [
            { quarter: 1, score: 66 },
            { quarter: 2, score: 0 },
            { quarter: 3, score: 0 },
            { quarter: 4, score: 0 }
          ]
        })
      ])
    );

    expect(response.body.selectedEmployee).toEqual(
      expect.objectContaining({
        employeeName: CURRENT_DEMO_EMPLOYEES.topRankEmployee.name,
        annualScore: CURRENT_DEMO_EMPLOYEES.topRankEmployee.annualScore
      })
    );
  });

  it('publishes annual scores when a missing quarter belongs only to an excluded employee', async () => {
    const year = 2029;
    const quarter = 1;
    const excludedEmployee = await pickAnnualExclusionEmployee(prisma);

    await prepareAnnualRankingYearForAllEmployeesExcept(prisma, year, quarter, excludedEmployee.id);

    const admin = await loginAsSysadmin(app);
    await admin
      .put('/api/admin/quarter-participation-exclusions')
      .send({
        year,
        quarter,
        userIds: [excludedEmployee.id]
      })
      .expect(200);

    const sectionLeader = await loginAsSectionLeader(app);
    const response = await sectionLeader.get(`/api/leader/annual-ranking?year=${year}`).expect(200);

    expect(response.body.scoresVisible).toBe(true);
    expect(response.body.ranking.some((entry: { employeeId: string }) => entry.employeeId === excludedEmployee.id)).toBe(true);
  });
});

async function pickAnnualExclusionEmployee(prisma: PrismaClient) {
  const employee = await prisma.user.findFirst({
    where: {
      isActive: true,
      roleAssignments: {
        some: {
          roleCode: 'employee',
          isEnabled: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    },
    select: {
      id: true
    }
  });

  if (!employee) {
    throw new Error('Expected at least one employee candidate for annual exclusion tests');
  }

  return employee;
}

async function prepareAnnualRankingYearForAllEmployeesExcept(
  prisma: PrismaClient,
  year: number,
  quarter: number,
  excludedEmployeeId: string
) {
  const employees = await prisma.user.findMany({
    where: {
      isActive: true,
      roleAssignments: {
        some: {
          roleCode: 'employee',
          isEnabled: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    },
    select: {
      id: true
    }
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.quarterParticipationExclusion.deleteMany({
      where: {
        year
      }
    });

    await transaction.goal.deleteMany({
      where: {
        year
      }
    });

    await transaction.historicalPerformanceScore.deleteMany({
      where: {
        year
      }
    });

    for (const employee of employees) {
      if (employee.id === excludedEmployeeId) {
        continue;
      }

      const goal = await transaction.goal.create({
        data: {
          ownerUserId: employee.id,
          year,
          quarter,
          code: 'O1',
          name: `Annual published goal ${employee.id.slice(-4)}`,
          description: 'Created for annual quarter participation exclusion coverage',
          status: 'completed',
          totalPoints: 100
        }
      });

      await transaction.keyResult.create({
        data: {
          goalId: goal.id,
          code: 'KR1',
          name: 'Annual published key result',
          description: 'Created for annual quarter participation exclusion coverage',
          points: 100,
          scoreType: 'objective',
          completionState: 'completed',
          reviewScore: 100,
          reviewComment: 'annual-quarter-participation-exclusion-test',
          reviewedAt: new Date('2026-03-31T10:00:00Z')
        }
      });
    }
  });
}
