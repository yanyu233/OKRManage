import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const prisma = new PrismaClient();

const GRADE_CODES = ['A+', 'A', 'B', 'C', 'D'] as const;
const QUARTER_YEAR = 2026;
const QUARTER_NUMBER = 1;
const proofStorageRoot = resolve(process.cwd(), process.env.PROOF_STORAGE_DIR?.trim() || 'storage/proofs');

async function main(): Promise<void> {
  const loginName = envOrDefault('DEBUG_SYSADMIN_LOGIN', 'sysadmin.local');
  const password = envOrDefault('DEBUG_SYSADMIN_PASSWORD', 'Admin123!');
  const sysadminName = envOrDefault('DEBUG_SYSADMIN_NAME', '\u4e25\u4e3b\u4efb');

  const department = await upsertDepartment('\u5de5\u4e1a\u4e92\u8054\u7f51\u4e2d\u5fc3');
  const sectionPlatform = await upsertSection(department.id, '\u5e73\u53f0\u4ea7\u54c1\u79d1');
  const sectionSolutions = await upsertSection(department.id, '\u89e3\u51b3\u65b9\u6848\u79d1');

  const digitalGroup = await upsertReviewGroup('\u4fe1\u606f\u5316\u7ec4', {
    'A+': 1,
    A: 0,
    B: 1,
    C: 0,
    D: 0
  });
  const operationsGroup = await upsertReviewGroup('\u8fd0\u8425\u7ec4', {
    'A+': 0,
    A: 0,
    B: 0,
    C: 0,
    D: 0
  });

  await mkdir(proofStorageRoot, { recursive: true });
  await upsertReviewGroup('\u7efc\u5408\u7ec4', {
    'A+': 0,
    A: 0,
    B: 0,
    C: 0,
    D: 0
  });

  await upsertGoalTemplate(sectionPlatform.departmentId, '\u5e73\u53f0\u79d1\u65b0\u5458\u5de5\u6a21\u677f', '\u7528\u4e8e\u5feb\u901f\u5bfc\u5165\u9996\u4e2a\u5b63\u5ea6\u901a\u7528\u76ee\u6807', [
    {
      code: 'KR1',
      name: '\u5b8c\u6210\u5b63\u5ea6\u9996\u4e2a\u7248\u672c\u4ea4\u4ed8',
      description: '\u8ddf\u8e2a\u76ee\u6807\u7248\u672c\u8ba1\u5212\u548c\u4ea4\u4ed8\u7ed3\u8bba',
      points: 30,
      scoreType: 'objective'
    },
    {
      code: 'KR2',
      name: '\u8f93\u51fa\u4e0a\u624b\u6587\u6863\u4e0e FAQ',
      description: '\u6c89\u6dc0\u4ea4\u4ed8\u8def\u5f84\u548c\u73af\u5883\u4f7f\u7528\u8bf4\u660e',
      points: 20,
      scoreType: 'subjective'
    }
  ]);

  await upsertGoalTemplate(sectionSolutions.departmentId, '\u8fd0\u8425\u652f\u6491\u6a21\u677f', '\u9002\u7528\u4e8e\u8fd0\u8425\u7ec4\u7684\u901a\u7528\u76ee\u6807\u6a21\u677f', [
    {
      code: 'KR1',
      name: '\u5b8c\u6210\u670d\u52a1\u4ea4\u63a5\u8ddf\u8e2a',
      description: '\u53ef\u89c6\u5316\u8bb0\u5f55\u6bcf\u5468\u4ea4\u63a5\u548c\u95ed\u73af',
      points: 25,
      scoreType: 'objective'
    },
    {
      code: 'KR2',
      name: '\u6c89\u6dc0\u8fd0\u8425\u652f\u6491\u6848\u4f8b',
      description: '\u8f93\u51fa\u53ef\u590d\u7528\u7684\u573a\u666f\u89e3\u51b3\u65b9\u6848',
      points: 25,
      scoreType: 'subjective'
    }
  ]);

  const sysadmin = await upsertUser({
    employeeNo: 'DEBUG-SYSADMIN',
    name: sysadminName,
    wecomUserId: 'sysadmin.routec',
    departmentId: department.id,
    sectionId: sectionPlatform.id,
    reviewGroupId: digitalGroup.id
  });
  await upsertLocalAccount(sysadmin.id, loginName, await bcrypt.hash(password, 10), true);
  await upsertRoleAssignment(sysadmin.id, 'system-admin', 'system', 'system', true);

  const departmentHead = await upsertUser({
    employeeNo: 'LEADER-DEPT-01',
    name: '\u90ed\u4e3b\u4efb',
    wecomUserId: 'guo.department',
    departmentId: department.id,
    sectionId: sectionPlatform.id,
    reviewGroupId: digitalGroup.id
  });
  await upsertLocalAccount(departmentHead.id, 'department.head', await bcrypt.hash('Leader123!', 10), true);
  await upsertRoleAssignment(
    departmentHead.id,
    'department-head',
    'department',
    `managed-department:${departmentHead.id}`,
    true
  );

  const sectionLeader = await upsertUser({
    employeeNo: 'LEADER-SECTION-01',
    name: '\u5218\u79d1\u957f',
    wecomUserId: 'liu.section',
    departmentId: department.id,
    sectionId: sectionPlatform.id,
    reviewGroupId: digitalGroup.id
  });
  await upsertLocalAccount(sectionLeader.id, 'section.leader', await bcrypt.hash('Leader123!', 10), true);
  await upsertRoleAssignment(sectionLeader.id, 'section-leader', 'section', sectionPlatform.id, true);
  await upsertSectionLeaderBinding(sectionLeader.id, sectionPlatform.id);

  const groupLeader = await upsertUser({
    employeeNo: 'LEADER-GROUP-01',
    name: '\u9a6c\u7ec4\u957f',
    wecomUserId: 'ma.group',
    departmentId: department.id,
    sectionId: sectionPlatform.id,
    reviewGroupId: digitalGroup.id
  });
  await upsertLocalAccount(groupLeader.id, 'group.leader', await bcrypt.hash('Leader123!', 10), true);
  await upsertRoleAssignment(groupLeader.id, 'group-leader', 'review-group', digitalGroup.id, true);
  await upsertRoleAssignment(groupLeader.id, 'employee', 'user', groupLeader.id, false);
  await upsertGroupLeaderBinding(groupLeader.id, digitalGroup.id);

  const zhangChen = await upsertUser({
    employeeNo: 'EMP-0001',
    name: '\u5f20\u6668',
    wecomUserId: 'zhangchen',
    departmentId: department.id,
    sectionId: sectionPlatform.id,
    reviewGroupId: digitalGroup.id
  });
  await upsertLocalAccount(zhangChen.id, 'zhang.chen', await bcrypt.hash('Employee123!', 10), true);
  await upsertRoleAssignment(zhangChen.id, 'employee', 'user', zhangChen.id, true);

  const wangMin = await upsertUser({
    employeeNo: 'EMP-0002',
    name: '\u738b\u654f',
    wecomUserId: 'wangmin',
    departmentId: department.id,
    sectionId: sectionPlatform.id,
    reviewGroupId: digitalGroup.id
  });
  await upsertLocalAccount(wangMin.id, 'wang.min', await bcrypt.hash('Employee123!', 10), true);
  await upsertRoleAssignment(wangMin.id, 'employee', 'user', wangMin.id, true);

  const liLei = await upsertUser({
    employeeNo: 'EMP-0003',
    name: '\u674e\u96f7',
    wecomUserId: 'lilei',
    departmentId: department.id,
    sectionId: sectionSolutions.id,
    reviewGroupId: operationsGroup.id
  });
  await upsertLocalAccount(liLei.id, 'li.lei', await bcrypt.hash('Employee123!', 10), true);
  await upsertRoleAssignment(liLei.id, 'employee', 'user', liLei.id, true);

  await seedGoalsForZhang(zhangChen.id, sectionLeader.id);
  await seedGoalsForWang(wangMin.id, sectionLeader.id);
  await seedGoalsForLi(liLei.id, sectionLeader.id);
  await seedGoalsForGroupLeader(groupLeader.id);
}

function envOrDefault(key: string, fallback: string): string {
  const value = process.env[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback;
  }

  return value;
}

async function upsertDepartment(name: string) {
  return prisma.department.upsert({
    where: { name },
    update: { isActive: true },
    create: { name, isActive: true }
  });
}

async function upsertSection(departmentId: string, name: string) {
  return prisma.section.upsert({
    where: {
      departmentId_name: {
        departmentId,
        name
      }
    },
    update: { isActive: true },
    create: {
      departmentId,
      name,
      isActive: true
    }
  });
}

async function upsertReviewGroup(name: string, seatCounts: Record<(typeof GRADE_CODES)[number], number>) {
  const reviewGroup = await prisma.reviewGroup.upsert({
    where: { name },
    update: { isActive: true },
    create: { name, isActive: true }
  });

  for (const gradeCode of GRADE_CODES) {
    await prisma.reviewGradeQuota.upsert({
      where: {
        reviewGroupId_gradeCode: {
          reviewGroupId: reviewGroup.id,
          gradeCode
        }
      },
      update: {
        seatCount: seatCounts[gradeCode]
      },
      create: {
        reviewGroupId: reviewGroup.id,
        gradeCode,
        seatCount: seatCounts[gradeCode]
      }
    });
  }

  return reviewGroup;
}

async function upsertUser(input: {
  employeeNo: string;
  name: string;
  wecomUserId: string;
  departmentId: string;
  sectionId: string;
  reviewGroupId: string;
}) {
  return prisma.user.upsert({
    where: { employeeNo: input.employeeNo },
    update: {
      name: input.name,
      wecomUserId: input.wecomUserId,
      departmentId: input.departmentId,
      sectionId: input.sectionId,
      reviewGroupId: input.reviewGroupId,
      isActive: true
    },
    create: {
      employeeNo: input.employeeNo,
      name: input.name,
      wecomUserId: input.wecomUserId,
      departmentId: input.departmentId,
      sectionId: input.sectionId,
      reviewGroupId: input.reviewGroupId,
      isActive: true
    }
  });
}

async function upsertLocalAccount(userId: string, loginName: string, passwordHash: string, localLoginEnabled: boolean) {
  return prisma.localAccount.upsert({
    where: { userId },
    update: {
      loginName,
      passwordHash,
      localLoginEnabled
    },
    create: {
      userId,
      loginName,
      passwordHash,
      localLoginEnabled
    }
  });
}

async function upsertRoleAssignment(
  userId: string,
  roleCode: string,
  scopeType: string,
  scopeId: string,
  isPrimary: boolean
) {
  return prisma.userRoleAssignment.upsert({
    where: {
      userId_roleCode_scopeType_scopeId: {
        userId,
        roleCode,
        scopeType,
        scopeId
      }
    },
    update: {
      isPrimary,
      isEnabled: true
    },
    create: {
      userId,
      roleCode,
      scopeType,
      scopeId,
      isPrimary,
      isEnabled: true
    }
  });
}

async function upsertSectionLeaderBinding(leaderUserId: string, sectionId: string) {
  return prisma.sectionLeaderBinding.upsert({
    where: {
      leaderUserId_sectionId: {
        leaderUserId,
        sectionId
      }
    },
    update: {},
    create: {
      leaderUserId,
      sectionId
    }
  });
}

async function upsertGroupLeaderBinding(leaderUserId: string, reviewGroupId: string) {
  return prisma.groupLeaderBinding.upsert({
    where: {
      leaderUserId_reviewGroupId: {
        leaderUserId,
        reviewGroupId
      }
    },
    update: {},
    create: {
      leaderUserId,
      reviewGroupId
    }
  });
}

async function upsertGoalTemplate(
  departmentId: string,
  name: string,
  description: string,
  keyResults: Array<{ code: string; name: string; description: string; points: number; scoreType?: 'objective' | 'subjective' }>
) {
  const template = await prisma.goalTemplate.upsert({
    where: {
      departmentId_name: {
        departmentId,
        name
      }
    },
    update: {
      description,
      isActive: true
    },
    create: {
      departmentId,
      name,
      description,
      isActive: true
    }
  });

  await prisma.goalTemplateKeyResult.deleteMany({
    where: {
      goalTemplateId: template.id
    }
  });

  if (keyResults.length) {
    await prisma.goalTemplateKeyResult.createMany({
      data: keyResults.map((keyResult) => ({
        goalTemplateId: template.id,
        code: keyResult.code,
        name: keyResult.name,
        description: keyResult.description,
        points: keyResult.points,
        scoreType: keyResult.scoreType ?? 'subjective'
      }))
    });
  }

  return template;
}

async function seedGoalsForZhang(ownerUserId: string, reviewerUserId: string) {
  const goalOne = await prisma.goal.upsert({
    where: {
      ownerUserId_year_quarter_code: {
        ownerUserId,
        year: QUARTER_YEAR,
        quarter: QUARTER_NUMBER,
        code: 'O1'
      }
    },
    update: {
      name: '\u5f20\u6668 2026 \u5e74\u4e00\u5b63\u5ea6 OKR',
      description: '\u56f4\u7ed5\u5e73\u53f0\u4ea4\u4ed8\u6548\u7387\u3001\u77e5\u8bc6\u6c89\u6dc0\u548c\u95ee\u9898\u95ed\u73af\u63a8\u8fdb\u5b63\u5ea6\u5de5\u4f5c\u3002',
      status: 'confirmed',
      totalPoints: 70
    },
    create: {
      ownerUserId,
      year: QUARTER_YEAR,
      quarter: QUARTER_NUMBER,
      code: 'O1',
      name: '\u5f20\u6668 2026 \u5e74\u4e00\u5b63\u5ea6 OKR',
      description: '\u56f4\u7ed5\u5e73\u53f0\u4ea4\u4ed8\u6548\u7387\u3001\u77e5\u8bc6\u6c89\u6dc0\u548c\u95ee\u9898\u95ed\u73af\u63a8\u8fdb\u5b63\u5ea6\u5de5\u4f5c\u3002',
      status: 'confirmed',
      totalPoints: 70
    }
  });

  const goalTwo = await prisma.goal.upsert({
    where: {
      ownerUserId_year_quarter_code: {
        ownerUserId,
        year: QUARTER_YEAR,
        quarter: QUARTER_NUMBER,
        code: 'O4'
      }
    },
    update: {
      name: '\u5f20\u6668 \u77e5\u8bc6\u5e93\u6c89\u6dc0\u4e13\u9879',
      description: '\u6c89\u6dc0\u5e73\u53f0\u5e38\u89c1\u95ee\u9898\u548c\u4ea4\u4ed8\u6848\u4f8b\uff0c\u4f5c\u4e3a\u5b63\u5ea6\u8865\u5145\u76ee\u6807\u3002',
      status: 'confirmed',
      totalPoints: 20
    },
    create: {
      ownerUserId,
      year: QUARTER_YEAR,
      quarter: QUARTER_NUMBER,
      code: 'O4',
      name: '\u5f20\u6668 \u77e5\u8bc6\u5e93\u6c89\u6dc0\u4e13\u9879',
      description: '\u6c89\u6dc0\u5e73\u53f0\u5e38\u89c1\u95ee\u9898\u548c\u4ea4\u4ed8\u6848\u4f8b\uff0c\u4f5c\u4e3a\u5b63\u5ea6\u8865\u5145\u76ee\u6807\u3002',
      status: 'confirmed',
      totalPoints: 20
    }
  });

  const kr1 = await upsertKeyResult({
    goalId: goalOne.id,
    code: 'KR1',
    name: '\u5b8c\u6210 6 \u4e2a\u7248\u672c\u4ea4\u4ed8',
    description: '\u8ddf\u8e2a\u5b63\u5ea6\u8ba1\u5212\u7248\u672c\u7684\u4ea4\u4ed8\u8282\u594f\u3002',
    points: 30,
    completionState: 'incomplete',
    reviewScore: 26.5,
    reviewComment: '\u7248\u672c\u4ea4\u4ed8\u8282\u594f\u7a33\u6b65\u63d0\u5347\u3002',
    reviewedByUserId: reviewerUserId
  });
  await upsertProof(
    kr1.id,
    '\u7248\u672c\u4ea4\u4ed8\u6e05\u5355.xlsx',
    'seed-release-checklist.xlsx',
    '\u7248\u672c\u4ea4\u4ed8\u8ddf\u8e2a\u8868',
    '\u7248\u672c\u4ea4\u4ed8\u8ddf\u8e2a\u8868'
  );
  await upsertProof(
    kr1.id,
    '\u5b63\u5ea6\u7248\u672c\u603b\u7ed3.pdf',
    'seed-release-summary.pdf',
    '\u5b63\u5ea6\u7248\u672c\u603b\u7ed3',
    '\u5b63\u5ea6\u7248\u672c\u603b\u7ed3'
  );

  await upsertKeyResult({
    goalId: goalOne.id,
    code: 'KR2',
    name: '\u77e5\u8bc6\u5e93\u8986\u76d6\u7387\u8fbe\u5230 80%',
    description: '\u8865\u9f50\u9ad8\u9891\u95ee\u9898\u548c\u89e3\u51b3\u65b9\u6848\u6587\u6863\u3002',
    points: 25,
    completionState: 'incomplete',
    reviewScore: 19.5,
    reviewComment: '\u8986\u76d6\u7387\u6301\u7eed\u63d0\u5347\uff0c\u8fd8\u9700\u7ee7\u7eed\u8865\u9f50\u3002',
    reviewedByUserId: reviewerUserId
  });

  await upsertKeyResult({
    goalId: goalOne.id,
    code: 'KR3',
    name: '\u95ee\u9898\u95ed\u73af\u65f6\u6548\u4e0d\u8d85\u8fc7 2 \u5929',
    description: '\u7f29\u77ed\u9ad8\u4f18\u95ee\u9898\u7684\u95ed\u73af\u5468\u671f\u3002',
    points: 15,
    completionState: 'incomplete',
    reviewScore: 12,
    reviewComment: '\u95ed\u73af\u65f6\u6548\u6539\u5584\u660e\u663e\uff0c\u4f46\u7a33\u5b9a\u6027\u8fd8\u9700\u52a0\u5f3a\u3002',
    reviewedByUserId: reviewerUserId
  });

  await upsertKeyResult({
    goalId: goalTwo.id,
    code: 'KR1',
    name: '\u6c89\u6dc0 20 \u7bc7\u77e5\u8bc6\u5e93\u5185\u5bb9',
    description: '\u5c06\u91cd\u590d\u4ea4\u4ed8\u95ee\u9898\u8f6c\u4e3a\u53ef\u590d\u7528\u77e5\u8bc6\u3002',
    points: 10,
    completionState: 'incomplete',
    reviewScore: null,
    reviewComment: null,
    reviewedByUserId: null
  });

  await upsertKeyResult({
    goalId: goalTwo.id,
    code: 'KR2',
    name: '\u8bd5\u8fd0\u884c FAQ \u6d41\u7a0b',
    description: '\u5efa\u7acb\u5e38\u89c1\u95ee\u9898\u7684\u8f7b\u91cf\u7b54\u7591\u673a\u5236\u3002',
    points: 5,
    completionState: 'incomplete',
    reviewScore: null,
    reviewComment: null,
    reviewedByUserId: null
  });

  await upsertKeyResult({
    goalId: goalTwo.id,
    code: 'KR3',
    name: '\u5efa\u7acb\u6587\u7ae0\u8bc4\u5ba1\u6e05\u5355',
    description: '\u4e3a\u77e5\u8bc6\u5e93\u5185\u5bb9\u589e\u52a0\u7edf\u4e00\u8d28\u91cf\u95e8\u69db\u3002',
    points: 5,
    completionState: 'incomplete',
    reviewScore: null,
    reviewComment: null,
    reviewedByUserId: null
  });

  const q3Goal = await prisma.goal.upsert({
    where: {
      ownerUserId_year_quarter_code: {
        ownerUserId,
        year: QUARTER_YEAR,
        quarter: 3,
        code: 'O1'
      }
    },
    update: {
      name: '\u5f20\u6668 2026 \u5e74\u4e09\u5b63\u5ea6\u4ea4\u4ed8\u8d28\u91cf\u8ffd\u8e2a',
      description: '\u8ddf\u8fdb\u4e09\u5b63\u5ea6\u4ea4\u4ed8\u8d28\u91cf\u4e0e\u77e5\u8bc6\u6c89\u6dc0\u95ed\u73af\u60c5\u51b5\u3002',
      status: 'confirmed',
      totalPoints: 79
    },
    create: {
      ownerUserId,
      year: QUARTER_YEAR,
      quarter: 3,
      code: 'O1',
      name: '\u5f20\u6668 2026 \u5e74\u4e09\u5b63\u5ea6\u4ea4\u4ed8\u8d28\u91cf\u8ffd\u8e2a',
      description: '\u8ddf\u8fdb\u4e09\u5b63\u5ea6\u4ea4\u4ed8\u8d28\u91cf\u4e0e\u77e5\u8bc6\u6c89\u6dc0\u95ed\u73af\u60c5\u51b5\u3002',
      status: 'confirmed',
      totalPoints: 79
    }
  });

  await upsertKeyResult({
    goalId: q3Goal.id,
    code: 'KR1',
    name: '\u4e09\u5b63\u5ea6\u7248\u672c\u4ea4\u4ed8\u8d28\u91cf\u7a33\u5b9a',
    description: '\u786e\u4fdd\u4e09\u5b63\u5ea6\u7248\u672c\u8fed\u4ee3\u548c\u8d28\u91cf\u6307\u6807\u7a33\u5b9a\u3002',
    points: 79,
    completionState: 'completed',
    reviewScore: 79,
    reviewComment: '\u4e09\u5b63\u5ea6\u4ea4\u4ed8\u6309\u9884\u671f\u8fbe\u6210\u3002',
    reviewedByUserId: reviewerUserId
  });
}

async function seedGoalsForWang(ownerUserId: string, reviewerUserId: string) {
  const goal = await prisma.goal.upsert({
    where: {
      ownerUserId_year_quarter_code: {
        ownerUserId,
        year: QUARTER_YEAR,
        quarter: QUARTER_NUMBER,
        code: 'O2'
      }
    },
    update: {
      name: '\u738b\u654f 2026 \u5e74\u4e00\u5b63\u5ea6\u4ea4\u4ed8\u8d28\u91cf\u63d0\u5347',
      description: '\u63d0\u5347\u5e73\u53f0\u4ea7\u54c1\u7ebf\u7684\u7a33\u5b9a\u6027\u548c\u4ea4\u4ed8\u8d28\u91cf\u3002',
      status: 'confirmed',
      totalPoints: 100
    },
    create: {
      ownerUserId,
      year: QUARTER_YEAR,
      quarter: QUARTER_NUMBER,
      code: 'O2',
      name: '\u738b\u654f 2026 \u5e74\u4e00\u5b63\u5ea6\u4ea4\u4ed8\u8d28\u91cf\u63d0\u5347',
      description: '\u63d0\u5347\u5e73\u53f0\u4ea7\u54c1\u7ebf\u7684\u7a33\u5b9a\u6027\u548c\u4ea4\u4ed8\u8d28\u91cf\u3002',
      status: 'confirmed',
      totalPoints: 100
    }
  });

  await upsertKeyResult({
    goalId: goal.id,
    code: 'KR1',
    name: '\u63d0\u5347\u5468\u5ea6\u4ea4\u4ed8\u8fbe\u6210\u7387',
    description: '\u786e\u4fdd\u5468\u5ea6\u627f\u8bfa\u4ea4\u4ed8\u6309\u8ba1\u5212\u843d\u5730\u3002',
    points: 50,
    completionState: 'completed',
    reviewScore: 46.25,
    reviewComment: '\u4ea4\u4ed8\u8282\u594f\u7a33\u5b9a\uff0c\u8fbe\u6210\u60c5\u51b5\u826f\u597d\u3002',
    reviewedByUserId: reviewerUserId
  });

  await upsertKeyResult({
    goalId: goal.id,
    code: 'KR2',
    name: '\u7f3a\u9677\u95ed\u73af\u8d28\u91cf\u8fbe\u5230 95%',
    description: '\u63d0\u5347\u91cd\u70b9\u7f3a\u9677\u7684\u5904\u7406\u8d28\u91cf\u3002',
    points: 30,
    completionState: 'completed',
    reviewScore: 27,
    reviewComment: '\u7f3a\u9677\u5904\u7406\u8d28\u91cf\u76ee\u6807\u57fa\u672c\u8fbe\u6210\u3002',
    reviewedByUserId: reviewerUserId
  });

  await upsertKeyResult({
    goalId: goal.id,
    code: 'KR3',
    name: '\u8bc4\u5ba1\u8fd4\u5de5\u7387\u63a7\u5236\u5728 10% \u5185',
    description: '\u964d\u4f4e\u8bc4\u5ba1\u73af\u8282\u4e2d\u53ef\u907f\u514d\u7684\u8fd4\u5de5\u3002',
    points: 20,
    completionState: 'completed',
    reviewScore: 17.4,
    reviewComment: '\u6574\u4f53\u7a33\u5b9a\uff0c\u5e76\u8fbe\u5230\u9884\u671f\u76ee\u6807\u3002',
    reviewedByUserId: reviewerUserId
  });

  const q2Goal = await prisma.goal.upsert({
    where: {
      ownerUserId_year_quarter_code: {
        ownerUserId,
        year: QUARTER_YEAR,
        quarter: 2,
        code: 'O1'
      }
    },
    update: {
      name: '\u738b\u654f 2026 \u5e74\u4e8c\u5b63\u5ea6\u4ea4\u4ed8\u7a33\u5b9a\u63d0\u5347',
      description: '\u805a\u7126\u4e8c\u5b63\u5ea6\u4ea4\u4ed8\u7a33\u5b9a\u6027\u548c\u8d28\u91cf\u95ed\u73af\u3002',
      status: 'confirmed',
      totalPoints: 66
    },
    create: {
      ownerUserId,
      year: QUARTER_YEAR,
      quarter: 2,
      code: 'O1',
      name: '\u738b\u654f 2026 \u5e74\u4e8c\u5b63\u5ea6\u4ea4\u4ed8\u7a33\u5b9a\u63d0\u5347',
      description: '\u805a\u7126\u4e8c\u5b63\u5ea6\u4ea4\u4ed8\u7a33\u5b9a\u6027\u548c\u8d28\u91cf\u95ed\u73af\u3002',
      status: 'confirmed',
      totalPoints: 66
    }
  });

  await upsertKeyResult({
    goalId: q2Goal.id,
    code: 'KR1',
    name: '\u4e8c\u5b63\u5ea6\u4ea4\u4ed8\u95ed\u73af\u8fbe\u6210',
    description: '\u786e\u4fdd\u4e8c\u5b63\u5ea6\u4ea4\u4ed8\u76ee\u6807\u5982\u671f\u5b8c\u6210\u3002',
    points: 66,
    completionState: 'completed',
    reviewScore: 66,
    reviewComment: '\u4e8c\u5b63\u5ea6\u76ee\u6807\u6309\u8ba1\u5212\u8fbe\u6210\u3002',
    reviewedByUserId: reviewerUserId
  });
}

async function seedGoalsForLi(ownerUserId: string, reviewerUserId: string) {
  const goal = await prisma.goal.upsert({
    where: {
      ownerUserId_year_quarter_code: {
        ownerUserId,
        year: QUARTER_YEAR,
        quarter: QUARTER_NUMBER,
        code: 'O3'
      }
    },
    update: {
      name: '\u674e\u96f7 \u8fd0\u8425\u652f\u6491\u4e13\u9879',
      description: '\u56f4\u7ed5\u8fd0\u8425\u94fe\u8def\u505a\u7ed3\u6784\u5316\u652f\u6491\u4e0e\u8ddf\u8fdb\u3002',
      status: 'confirmed',
      totalPoints: 60
    },
    create: {
      ownerUserId,
      year: QUARTER_YEAR,
      quarter: QUARTER_NUMBER,
      code: 'O3',
      name: '\u674e\u96f7 \u8fd0\u8425\u652f\u6491\u4e13\u9879',
      description: '\u56f4\u7ed5\u8fd0\u8425\u94fe\u8def\u505a\u7ed3\u6784\u5316\u652f\u6491\u4e0e\u8ddf\u8fdb\u3002',
      status: 'confirmed',
      totalPoints: 60
    }
  });

  await upsertKeyResult({
    goalId: goal.id,
    code: 'KR1',
    name: '\u5b8c\u6210 10 \u6b21\u652f\u6301\u4ea4\u63a5',
    description: '\u786e\u4fdd\u652f\u6301\u4ea4\u63a5\u8fc7\u7a0b\u53ef\u8ffd\u8e2a\u3001\u53ef\u95ed\u73af\u3002',
    points: 30,
    completionState: 'incomplete',
    reviewScore: 25.5,
    reviewComment: '\u652f\u6491\u4ea4\u63a5\u6267\u884c\u8f83\u7a33\u5b9a\u3002',
    reviewedByUserId: reviewerUserId
  });

  await upsertKeyResult({
    goalId: goal.id,
    code: 'KR2',
    name: '\u7ef4\u62a4\u5468\u5ea6\u670d\u52a1\u770b\u677f',
    description: '\u6309\u5468\u66f4\u65b0\u670d\u52a1\u770b\u677f\u5e76\u6301\u7eed\u8ddf\u8fdb\u3002',
    points: 30,
    completionState: 'incomplete',
    reviewScore: 24,
    reviewComment: '\u770b\u677f\u8986\u76d6\u7387\u8fbe\u5230\u9884\u671f\u3002',
    reviewedByUserId: reviewerUserId
  });
}

async function seedGoalsForGroupLeader(ownerUserId: string) {
  const goal = await prisma.goal.upsert({
    where: {
      ownerUserId_year_quarter_code: {
        ownerUserId,
        year: QUARTER_YEAR,
        quarter: QUARTER_NUMBER,
        code: 'O6'
      }
    },
    update: {
      name: '\u9a6c\u7ec4\u957f \u53cc\u89d2\u8272\u9a8c\u8bc1\u76ee\u6807',
      description: '\u7528\u4e8e\u9a8c\u8bc1\u540c\u4e00\u8d26\u53f7\u517c\u5177\u8d1f\u8d23\u4eba\u548c\u5458\u5de5\u89d2\u8272\u7684\u6d41\u7a0b\u3002',
      status: 'confirmed',
      totalPoints: 40
    },
    create: {
      ownerUserId,
      year: QUARTER_YEAR,
      quarter: QUARTER_NUMBER,
      code: 'O6',
      name: '\u9a6c\u7ec4\u957f \u53cc\u89d2\u8272\u9a8c\u8bc1\u76ee\u6807',
      description: '\u7528\u4e8e\u9a8c\u8bc1\u540c\u4e00\u8d26\u53f7\u517c\u5177\u8d1f\u8d23\u4eba\u548c\u5458\u5de5\u89d2\u8272\u7684\u6d41\u7a0b\u3002',
      status: 'confirmed',
      totalPoints: 40
    }
  });

  await upsertKeyResult({
    goalId: goal.id,
    code: 'KR1',
    name: '\u4fdd\u6301\u53cc\u89d2\u8272\u94fe\u8def\u53ef\u7528',
    description: '\u7528\u4e8e\u5458\u5de5\u7aef\u4e0e\u8d1f\u8d23\u4eba\u7aef\u8054\u8c03\u9a8c\u8bc1\u3002',
    points: 40,
    completionState: 'incomplete',
    reviewScore: null,
    reviewComment: null,
    reviewedByUserId: null
  });
}

async function upsertKeyResult(input: {
  goalId: string;
  code: string;
  name: string;
  description: string;
  points: number;
  scoreType?: 'objective' | 'subjective';
  completionState: string;
  reviewScore: number | null;
  reviewComment: string | null;
  reviewedByUserId: string | null;
}) {
  return prisma.keyResult.upsert({
    where: {
      goalId_code: {
        goalId: input.goalId,
        code: input.code
      }
    },
    update: {
      name: input.name,
      description: input.description,
      points: input.points,
      scoreType: input.scoreType ?? 'objective',
      completionState: input.completionState,
      reviewScore: input.reviewScore,
      reviewComment: input.reviewComment,
      reviewedByUserId: input.reviewedByUserId,
      reviewedAt: input.reviewScore === null ? null : new Date('2026-03-25T10:00:00Z')
    },
    create: {
      goalId: input.goalId,
      code: input.code,
      name: input.name,
      description: input.description,
      points: input.points,
      scoreType: input.scoreType ?? 'objective',
      completionState: input.completionState,
      reviewScore: input.reviewScore,
      reviewComment: input.reviewComment,
      reviewedByUserId: input.reviewedByUserId,
      reviewedAt: input.reviewScore === null ? null : new Date('2026-03-25T10:00:00Z')
    }
  });
}

async function upsertProof(
  keyResultId: string,
  fileName: string,
  storageKey: string,
  note: string,
  content: string
) {
  const fileBuffer = Buffer.from(content, 'utf8');
  await writeFile(join(proofStorageRoot, storageKey), fileBuffer);

  return prisma.proof.create({
    data: {
      keyResultId,
      fileName,
      fileUrl: storageKey,
      fileSize: fileBuffer.length,
      note,
      uploadedAt: new Date('2026-03-25T09:40:00Z')
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('seed completed');
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
