import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const prisma = new PrismaClient();

const GRADE_CODES = ['A+', 'A', 'B+', 'B', 'C'] as const;
const QUARTER_YEAR = 2026;
const QUARTER_NUMBER = 1;
const proofStorageRoot = resolve(process.cwd(), process.env.PROOF_STORAGE_DIR?.trim() || 'storage/proofs');

async function main(): Promise<void> {
  const loginName = envOrDefault('DEBUG_SYSADMIN_LOGIN', 'sysadmin.local');
  const password = envOrDefault('DEBUG_SYSADMIN_PASSWORD', 'Admin123!');
  const sysadminName = envOrDefault('DEBUG_SYSADMIN_NAME', 'System Admin');

  const department = await upsertDepartment('Industrial Internet Center');
  const sectionPlatform = await upsertSection(department.id, 'Platform Products');
  const sectionSolutions = await upsertSection(department.id, 'Solution Delivery');

  const digitalGroup = await upsertReviewGroup('Digital Group', {
    'A+': 1,
    A: 0,
    'B+': 1,
    B: 0,
    C: 0
  });
  const operationsGroup = await upsertReviewGroup('Operations Group', {
    'A+': 0,
    A: 0,
    'B+': 0,
    B: 0,
    C: 0
  });

  await mkdir(proofStorageRoot, { recursive: true });
  await upsertReviewGroup('General Group', {
    'A+': 0,
    A: 0,
    'B+': 0,
    B: 0,
    C: 0
  });

  const sysadmin = await upsertUser({
    employeeNo: 'DEBUG-SYSADMIN',
    name: sysadminName,
    departmentId: department.id,
    sectionId: sectionPlatform.id,
    reviewGroupId: digitalGroup.id
  });
  await upsertLocalAccount(sysadmin.id, loginName, await bcrypt.hash(password, 10), true);
  await upsertRoleAssignment(sysadmin.id, 'system-admin', 'system', 'system', true);

  const sectionLeader = await upsertUser({
    employeeNo: 'LEADER-SECTION-01',
    name: 'Liu Section',
    departmentId: department.id,
    sectionId: sectionPlatform.id,
    reviewGroupId: digitalGroup.id
  });
  await upsertLocalAccount(sectionLeader.id, 'section.leader', await bcrypt.hash('Leader123!', 10), true);
  await upsertRoleAssignment(sectionLeader.id, 'section-leader', 'section', sectionPlatform.id, true);
  await upsertSectionLeaderBinding(sectionLeader.id, sectionPlatform.id);

  const groupLeader = await upsertUser({
    employeeNo: 'LEADER-GROUP-01',
    name: 'Ma Group',
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
    name: 'Zhang Chen',
    departmentId: department.id,
    sectionId: sectionPlatform.id,
    reviewGroupId: digitalGroup.id
  });
  await upsertLocalAccount(zhangChen.id, 'zhang.chen', await bcrypt.hash('Employee123!', 10), true);
  await upsertRoleAssignment(zhangChen.id, 'employee', 'user', zhangChen.id, true);

  const wangMin = await upsertUser({
    employeeNo: 'EMP-0002',
    name: 'Wang Min',
    departmentId: department.id,
    sectionId: sectionPlatform.id,
    reviewGroupId: digitalGroup.id
  });
  await upsertLocalAccount(wangMin.id, 'wang.min', await bcrypt.hash('Employee123!', 10), true);
  await upsertRoleAssignment(wangMin.id, 'employee', 'user', wangMin.id, true);

  const liLei = await upsertUser({
    employeeNo: 'EMP-0003',
    name: 'Li Lei',
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
  departmentId: string;
  sectionId: string;
  reviewGroupId: string;
}) {
  return prisma.user.upsert({
    where: { employeeNo: input.employeeNo },
    update: {
      name: input.name,
      departmentId: input.departmentId,
      sectionId: input.sectionId,
      reviewGroupId: input.reviewGroupId,
      isActive: true
    },
    create: {
      employeeNo: input.employeeNo,
      name: input.name,
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
      name: 'Zhang Chen 2026 Q1 OKR',
      description: 'Improve release delivery pace and close operational issues on time.',
      status: 'confirmed',
      totalPoints: 80
    },
    create: {
      ownerUserId,
      year: QUARTER_YEAR,
      quarter: QUARTER_NUMBER,
      code: 'O1',
      name: 'Zhang Chen 2026 Q1 OKR',
      description: 'Improve release delivery pace and close operational issues on time.',
      status: 'confirmed',
      totalPoints: 80
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
      name: 'Zhang Chen Knowledge Program',
      description: 'Capture recurring incidents and delivery cases as reusable knowledge assets.',
      status: 'confirmed',
      totalPoints: 40
    },
    create: {
      ownerUserId,
      year: QUARTER_YEAR,
      quarter: QUARTER_NUMBER,
      code: 'O4',
      name: 'Zhang Chen Knowledge Program',
      description: 'Capture recurring incidents and delivery cases as reusable knowledge assets.',
      status: 'confirmed',
      totalPoints: 40
    }
  });

  const kr1 = await upsertKeyResult({
    goalId: goalOne.id,
    code: 'KR1',
    name: 'Deliver 6 releases',
    description: 'Track planned release delivery through the quarter.',
    points: 35,
    completionState: 'incomplete',
    reviewScore: 86,
    reviewComment: 'Release cadence is improving steadily.',
    reviewedByUserId: reviewerUserId
  });
  await upsertProof(kr1.id, 'release-checklist.xlsx', 'seed-release-checklist.xlsx', 'Release tracking sheet', 'seed release checklist');
  await upsertProof(kr1.id, 'release-summary.pdf', 'seed-release-summary.pdf', 'Quarter release summary', 'seed release summary');

  await upsertKeyResult({
    goalId: goalOne.id,
    code: 'KR2',
    name: 'Reach 80% knowledge coverage',
    description: 'Expand documented solutions in the knowledge base.',
    points: 25,
    completionState: 'incomplete',
    reviewScore: 78,
    reviewComment: 'Coverage is improving but not complete yet.',
    reviewedByUserId: reviewerUserId
  });

  await upsertKeyResult({
    goalId: goalOne.id,
    code: 'KR3',
    name: 'Keep incident closure under 2 days',
    description: 'Reduce cycle time for issue closure.',
    points: 20,
    completionState: 'incomplete',
    reviewScore: 70,
    reviewComment: 'Cycle time improved, still needs consistency.',
    reviewedByUserId: reviewerUserId
  });

  await upsertKeyResult({
    goalId: goalTwo.id,
    code: 'KR1',
    name: 'Publish 20 knowledge articles',
    description: 'Create reusable content from recurring delivery issues.',
    points: 20,
    completionState: 'incomplete',
    reviewScore: null,
    reviewComment: null,
    reviewedByUserId: null
  });

  await upsertKeyResult({
    goalId: goalTwo.id,
    code: 'KR2',
    name: 'Pilot FAQ workflow',
    description: 'Create a lightweight FAQ process for repeated questions.',
    points: 10,
    completionState: 'incomplete',
    reviewScore: null,
    reviewComment: null,
    reviewedByUserId: null
  });

  await upsertKeyResult({
    goalId: goalTwo.id,
    code: 'KR3',
    name: 'Build article review checklist',
    description: 'Create a reusable quality gate for new knowledge entries.',
    points: 10,
    completionState: 'incomplete',
    reviewScore: null,
    reviewComment: null,
    reviewedByUserId: null
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
      name: 'Wang Min 2026 Q1 Delivery Quality',
      description: 'Improve stability and delivery quality for the platform product line.',
      status: 'confirmed',
      totalPoints: 100
    },
    create: {
      ownerUserId,
      year: QUARTER_YEAR,
      quarter: QUARTER_NUMBER,
      code: 'O2',
      name: 'Wang Min 2026 Q1 Delivery Quality',
      description: 'Improve stability and delivery quality for the platform product line.',
      status: 'confirmed',
      totalPoints: 100
    }
  });

  await upsertKeyResult({
    goalId: goal.id,
    code: 'KR1',
    name: 'Improve weekly delivery predictability',
    description: 'Keep committed weekly deliveries on schedule.',
    points: 50,
    completionState: 'completed',
    reviewScore: 92.5,
    reviewComment: 'Delivery discipline is strong.',
    reviewedByUserId: reviewerUserId
  });

  await upsertKeyResult({
    goalId: goal.id,
    code: 'KR2',
    name: 'Raise defect closure quality to 95%',
    description: 'Improve resolution quality for major defects.',
    points: 30,
    completionState: 'completed',
    reviewScore: 90,
    reviewComment: 'Defect quality target is mostly achieved.',
    reviewedByUserId: reviewerUserId
  });

  await upsertKeyResult({
    goalId: goal.id,
    code: 'KR3',
    name: 'Keep review rework under 10%',
    description: 'Reduce avoidable rework in review loops.',
    points: 20,
    completionState: 'completed',
    reviewScore: 87,
    reviewComment: 'Stable and above target overall.',
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
      name: 'Li Lei Operations Enablement',
      description: 'Support the operations stream with structured follow-up work.',
      status: 'confirmed',
      totalPoints: 60
    },
    create: {
      ownerUserId,
      year: QUARTER_YEAR,
      quarter: QUARTER_NUMBER,
      code: 'O3',
      name: 'Li Lei Operations Enablement',
      description: 'Support the operations stream with structured follow-up work.',
      status: 'confirmed',
      totalPoints: 60
    }
  });

  await upsertKeyResult({
    goalId: goal.id,
    code: 'KR1',
    name: 'Complete 10 support handoffs',
    description: 'Ensure support handoffs are documented and closed.',
    points: 30,
    completionState: 'incomplete',
    reviewScore: 85,
    reviewComment: 'Solid support execution.',
    reviewedByUserId: reviewerUserId
  });

  await upsertKeyResult({
    goalId: goal.id,
    code: 'KR2',
    name: 'Maintain weekly service dashboard',
    description: 'Keep the weekly dashboard updated.',
    points: 30,
    completionState: 'incomplete',
    reviewScore: 80,
    reviewComment: 'Dashboard coverage is acceptable.',
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
      name: 'Ma Group Dual Role Goal',
      description: 'Keep leader and employee flows available for the dual-role account.',
      status: 'confirmed',
      totalPoints: 40
    },
    create: {
      ownerUserId,
      year: QUARTER_YEAR,
      quarter: QUARTER_NUMBER,
      code: 'O6',
      name: 'Ma Group Dual Role Goal',
      description: 'Keep leader and employee flows available for the dual-role account.',
      status: 'confirmed',
      totalPoints: 40
    }
  });

  await upsertKeyResult({
    goalId: goal.id,
    code: 'KR1',
    name: 'Keep dual-role smoke path available',
    description: 'A lightweight KR for employee-side validation with the dual-role account.',
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
