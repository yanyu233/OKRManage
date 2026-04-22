import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { closeTestDatabase, resetTestDatabase } from './support/test-db';
import { createTestApp, loginAsEmployee, loginAsSectionLeader, loginAsSysadmin } from './support/test-app';

describe('Leader ranking', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    await resetTestDatabase();
    process.env.DATABASE_URL = process.env.OKR_E2E_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
    prisma = new PrismaClient();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    await closeTestDatabase();
  });

  it('masks all-okr quarter scores for non-system-admins until the full quarter is scored', async () => {
    const agent = await loginAsEmployee(app);
    const response = await agent.get('/api/leader/all-okr?year=2026&quarter=1').expect(200);

    expect(response.body.scoresVisible).toBe(false);
    expect(response.body.employees.length).toBeGreaterThan(0);
    expect(
      response.body.employees.every(
        (employee: {
          quarterScore: number | null;
          goals: Array<{
            currentScore: number | null;
            keyResults: Array<{ reviewScore: number | null; reviewComment: string | null }>;
          }>;
        }) =>
          employee.quarterScore === null &&
          employee.goals.every(
            (goal) =>
              goal.currentScore === null &&
              goal.keyResults.every((keyResult) => keyResult.reviewScore === null && keyResult.reviewComment === null)
          )
      )
    ).toBe(true);
  });

  it('hides ranking details for non-system-admins until the full quarter is scored', async () => {
    const agent = await loginAsSectionLeader(app);
    const response = await agent.get('/api/leader/ranking?year=2026&quarter=1').expect(200);

    expect(response.body.scoresVisible).toBe(false);
    expect(response.body.reviewGroups.length).toBeGreaterThan(0);
    expect(response.body.selectedReviewGroup).not.toBeNull();
    expect(response.body.seatSummary).toEqual([]);
    expect(response.body.ranking).toEqual([]);
    expect(response.body.selectedEmployee).toBeNull();
    expect(response.body.pendingTieGroups).toEqual([]);
  });

  it('marks unresolved ties as pending and lets system admins save the final order', async () => {
    const reviewGroupId = 'review-group-l1wxk9';
    const targetEmployeeIds = await prepareQuarterRankingTieScenario(prisma, reviewGroupId);
    const agent = await loginAsSysadmin(app);

    const before = await agent
      .get(`/api/leader/ranking?year=2026&quarter=1&reviewGroupId=${reviewGroupId}`)
      .expect(200);

    expect(before.body.scoresVisible).toBe(true);
    expect(before.body.canManageTieBreaks).toBe(true);
    expect(before.body.seatSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ gradeCode: 'A+', seatCount: 1 }),
        expect.objectContaining({ gradeCode: 'A', seatCount: 1 })
      ])
    );

    const tieGroup = before.body.pendingTieGroups.find(
      (entry: { reviewGroupId: string; employees: Array<{ employeeId: string }> }) =>
        entry.reviewGroupId === reviewGroupId &&
        entry.employees.some((employee) => targetEmployeeIds.includes(employee.employeeId))
    );

    expect(tieGroup).toBeTruthy();
    expect(tieGroup.affectedGradeCodes).toEqual(['A+', 'A']);
    expect([...tieGroup.employees.map((employee: { employeeId: string }) => employee.employeeId)].sort()).toEqual(
      [...targetEmployeeIds].sort()
    );

    const pendingEntries = before.body.ranking.filter((entry: { employeeId: string }) =>
      targetEmployeeIds.includes(entry.employeeId)
    );
    expect(pendingEntries).toHaveLength(2);
    expect(
      pendingEntries.every(
        (entry: { currentGrade: string | null; tieBreakStatus: string }) =>
          entry.currentGrade === null && entry.tieBreakStatus === 'pending'
      )
    ).toBe(true);

    const orderedEmployeeIds = [...targetEmployeeIds].reverse();
    await agent
      .post('/api/leader/ranking/tie-breaks')
      .send({
        year: 2026,
        quarter: 1,
        reviewGroupId,
        groupKey: tieGroup.groupKey,
        orderedEmployeeIds
      })
      .expect(200);

    const after = await agent
      .get(`/api/leader/ranking?year=2026&quarter=1&reviewGroupId=${reviewGroupId}`)
      .expect(200);

    expect(after.body.pendingTieGroups).toEqual([]);

    const resolvedEntries = after.body.ranking.filter((entry: { employeeId: string }) =>
      orderedEmployeeIds.includes(entry.employeeId)
    );
    const gradeByEmployeeId = new Map(
      resolvedEntries.map((entry: { employeeId: string; currentGrade: string | null; tieBreakStatus: string }) => [
        entry.employeeId,
        {
          currentGrade: entry.currentGrade,
          tieBreakStatus: entry.tieBreakStatus
        }
      ])
    );

    expect(gradeByEmployeeId.get(orderedEmployeeIds[0])).toEqual({
      currentGrade: 'A+',
      tieBreakStatus: 'resolved'
    });
    expect(gradeByEmployeeId.get(orderedEmployeeIds[1])).toEqual({
      currentGrade: 'A',
      tieBreakStatus: 'resolved'
    });
  });

  it('publishes quarter data when only excluded employees are missing current-quarter goals', async () => {
    const year = 2028;
    const quarter = 4;
    const excludedEmployee = await pickQuarterExclusionEmployee(prisma);

    await preparePublishedQuarterForAllEmployeesExcept(prisma, year, quarter, excludedEmployee.id);

    const admin = await loginAsSysadmin(app);
    await admin
      .put('/api/admin/quarter-participation-exclusions')
      .send({
        year,
        quarter,
        userIds: [excludedEmployee.id]
      })
      .expect(200);

    const employeeAgent = await loginAsEmployee(app);
    const allOkr = await employeeAgent.get(`/api/leader/all-okr?year=${year}&quarter=${quarter}`).expect(200);

    expect(allOkr.body.scoresVisible).toBe(true);
    expect(allOkr.body.employees.some((entry: { id: string }) => entry.id === excludedEmployee.id)).toBe(false);

    const sectionLeader = await loginAsSectionLeader(app);
    const rankingQuery = excludedEmployee.reviewGroupId
      ? `/api/leader/ranking?year=${year}&quarter=${quarter}&reviewGroupId=${excludedEmployee.reviewGroupId}`
      : `/api/leader/ranking?year=${year}&quarter=${quarter}`;
    const ranking = await sectionLeader.get(rankingQuery).expect(200);

    expect(ranking.body.scoresVisible).toBe(true);
    expect(ranking.body.ranking.some((entry: { employeeId: string }) => entry.employeeId === excludedEmployee.id)).toBe(false);
  });
});

async function prepareQuarterRankingTieScenario(prisma: PrismaClient, reviewGroupId: string) {
  const allEmployees = await prisma.user.findMany({
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
  const candidateEmployees = await prisma.user.findMany({
    where: {
      isActive: true,
      reviewGroupId,
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

  const targetEmployeeIds = candidateEmployees.slice(0, 2).map((employee) => employee.id);
  if (targetEmployeeIds.length < 2) {
    throw new Error('Expected at least two employee candidates in the review group');
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.reviewGradeQuota.updateMany({
      where: {
        reviewGroupId
      },
      data: {
        seatCount: 0
      }
    });

    await transaction.reviewGradeQuota.update({
      where: {
        reviewGroupId_gradeCode: {
          reviewGroupId,
          gradeCode: 'A+'
        }
      },
      data: {
        seatCount: 1
      }
    });

    await transaction.reviewGradeQuota.update({
      where: {
        reviewGroupId_gradeCode: {
          reviewGroupId,
          gradeCode: 'A'
        }
      },
      data: {
        seatCount: 1
      }
    });

    await transaction.keyResult.updateMany({
      where: {
        goal: {
          year: 2026,
          quarter: 1
        },
        reviewScore: null
      },
      data: {
        reviewScore: 0,
        reviewComment: 'ranking-tie-test',
        reviewedAt: new Date('2026-03-31T10:00:00Z')
      }
    });

    await transaction.goal.updateMany({
      where: {
        year: 2026,
        quarter: 1
      },
      data: {
        status: 'completed'
      }
    });

    await transaction.goal.deleteMany({
      where: {
        ownerUserId: {
          in: targetEmployeeIds
        },
        year: 2026,
        quarter: 1
      }
    });

    for (const [index, ownerUserId] of targetEmployeeIds.entries()) {
      const goal = await transaction.goal.create({
        data: {
          ownerUserId,
          year: 2026,
          quarter: 1,
          code: 'O1',
          name: `Tie goal ${index + 1}`,
          description: 'Created by leader ranking tie-break test',
          status: 'completed',
          totalPoints: 100
        }
      });

      await transaction.keyResult.createMany({
        data: [
          buildTieBreakKeyResult(goal.id, 'KR1', '自建目标推进', 60, 60),
          buildTieBreakKeyResult(goal.id, 'KR2', '目标任务综合评价', 10, 10, 'subjective'),
          buildTieBreakKeyResult(goal.id, 'KR3', '工作态度', 8, 8, 'subjective'),
          buildTieBreakKeyResult(goal.id, 'KR4', '工作能力', 8, 8, 'subjective'),
          buildTieBreakKeyResult(goal.id, 'KR5', '创优争先', 7, 7, 'subjective'),
          buildTieBreakKeyResult(goal.id, 'KR6', '学习分享', 7, 7, 'subjective')
        ]
      });
    }

    const quarterGoalOwners = new Set(
      (
        await transaction.goal.findMany({
          where: {
            year: 2026,
            quarter: 1
          },
          select: {
            ownerUserId: true
          }
        })
      ).map((goal) => goal.ownerUserId)
    );

    const employeeIdsMissingQuarterGoals = allEmployees
      .map((employee) => employee.id)
      .filter((employeeId) => !quarterGoalOwners.has(employeeId));

    for (const ownerUserId of employeeIdsMissingQuarterGoals) {
      const goal = await transaction.goal.create({
        data: {
          ownerUserId,
          year: 2026,
          quarter: 1,
          code: 'O1',
          name: 'Baseline tie-break coverage goal',
          description: 'Ensures every employee has a fully scored Q1 goal for ranking publication tests',
          status: 'completed',
          totalPoints: 100
        }
      });

      await transaction.keyResult.create({
        data: buildTieBreakKeyResult(goal.id, 'KR1', 'Baseline scored key result', 100, 100)
      });
    }
  });

  return targetEmployeeIds;
}

function buildTieBreakKeyResult(
  goalId: string,
  code: string,
  name: string,
  points: number,
  reviewScore: number,
  scoreType: 'objective' | 'subjective' = 'objective'
) {
  return {
    goalId,
    code,
    name,
    description: `${name} test metric`,
    points,
    scoreType,
    completionState: 'completed',
    reviewScore,
    reviewComment: 'ranking-tie-test',
    reviewedAt: new Date('2026-03-31T10:00:00Z'),
    reviewedByUserId: null
  };
}

async function pickQuarterExclusionEmployee(prisma: PrismaClient) {
  const employee = await prisma.user.findFirst({
    where: {
      isActive: true,
      reviewGroupId: {
        not: null
      },
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
      id: true,
      reviewGroupId: true
    }
  });

  if (!employee) {
    throw new Error('Expected at least one employee candidate for quarter exclusion tests');
  }

  return employee;
}

async function preparePublishedQuarterForAllEmployeesExcept(
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
        year,
        quarter
      }
    });

    await transaction.goal.deleteMany({
      where: {
        year,
        quarter
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
          name: `Published goal ${employee.id.slice(-4)}`,
          description: 'Created for quarter participation exclusion coverage',
          status: 'completed',
          totalPoints: 100
        }
      });

      await transaction.keyResult.create({
        data: {
          goalId: goal.id,
          code: 'KR1',
          name: 'Published key result',
          description: 'Created for quarter participation exclusion coverage',
          points: 100,
          scoreType: 'objective',
          completionState: 'completed',
          reviewScore: 100,
          reviewComment: 'quarter-participation-exclusion-test',
          reviewedAt: new Date('2026-03-31T10:00:00Z')
        }
      });
    }
  });
}
