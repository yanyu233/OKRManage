import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

type ReviewGroupQuotaFixture = {
  gradeCode: string;
  seatCount: number;
};

type GoalTemplateKeyResultFixture = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  points: number;
  scoreType?: 'objective' | 'subjective';
};

type GoalTemplateFixture = {
  id: string;
  departmentId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  keyResults: GoalTemplateKeyResultFixture[];
};

type AdminBootstrapFixture = {
  departments: Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>;
  sections: Array<{
    id: string;
    departmentId: string;
    name: string;
    isActive: boolean;
  }>;
  users: Array<{
    id: string;
    employeeNo?: string | null;
    name: string;
    positionName?: string | null;
    departmentId?: string | null;
    sectionId?: string | null;
    reviewGroupId?: string | null;
    isActive: boolean;
  }>;
  localAccounts: Array<{
    userId: string;
    loginName: string;
    localLoginEnabled: boolean;
    password?: string | null;
  }>;
  roleAssignments: Array<{
    id: string;
    userId: string;
    roleCode: string;
    scopeType: string;
    scopeId: string;
    isPrimary: boolean;
    isEnabled: boolean;
  }>;
  sectionLeaderBindings: Array<{
    id: string;
    leaderUserId: string;
    sectionId: string;
  }>;
  groupLeaderBindings: Array<{
    id: string;
    leaderUserId: string;
    reviewGroupId: string;
  }>;
  reviewGroups: Array<{
    id: string;
    name: string;
    isActive: boolean;
    quotas: ReviewGroupQuotaFixture[];
  }>;
  goalTemplates: GoalTemplateFixture[];
};

type SeedCurrentDemoProfileOptions = {
  proofStorageRoot: string;
  defaultLocalPassword: string;
};

const FIXTURE_PATH = resolve(process.cwd(), 'test', 'fixtures', 'admin-bootstrap-current-demo.fixture.json');

const ACTOR_NAMES = {
  employeeLeader: '陈美果',
  topRankEmployee: '杨增禄',
  secondRankEmployee: '蒲雪映',
  outOfScopeEmployee: '潘红'
} as const;

const QUARTER_START = {
  q1: new Date('2026-03-25T09:00:00.000Z'),
  q2: new Date('2026-06-25T09:00:00.000Z'),
  q3: new Date('2026-09-25T09:00:00.000Z'),
  q4: new Date('2026-12-25T09:00:00.000Z')
} as const;

export async function seedCurrentDemoProfile(prisma: PrismaClient, options: SeedCurrentDemoProfileOptions) {
  const fixture = await loadFixture();

  await seedBootstrapFixture(prisma, fixture, options.defaultLocalPassword);
  await seedScenarioGoals(prisma, options.proofStorageRoot);
}

async function loadFixture() {
  const raw = await readFile(FIXTURE_PATH, 'utf8');
  return JSON.parse(raw) as AdminBootstrapFixture;
}

async function seedBootstrapFixture(prisma: PrismaClient, fixture: AdminBootstrapFixture, defaultLocalPassword: string) {
  const passwordHashCache = new Map<string, string>();

  for (const department of fixture.departments) {
    await prisma.department.create({
      data: {
        id: department.id,
        name: department.name,
        isActive: department.isActive
      }
    });
  }

  for (const reviewGroup of fixture.reviewGroups) {
    await prisma.reviewGroup.create({
      data: {
        id: reviewGroup.id,
        name: reviewGroup.name,
        isActive: reviewGroup.isActive
      }
    });

    for (const quota of reviewGroup.quotas) {
      await prisma.reviewGradeQuota.create({
        data: {
          reviewGroupId: reviewGroup.id,
          gradeCode: quota.gradeCode,
          seatCount: quota.seatCount
        }
      });
    }
  }

  for (const section of fixture.sections) {
    await prisma.section.create({
      data: {
        id: section.id,
        departmentId: section.departmentId,
        name: section.name,
        isActive: section.isActive
      }
    });
  }

  for (const user of fixture.users) {
    await prisma.user.create({
      data: {
        id: user.id,
        employeeNo: user.employeeNo ?? null,
        name: user.name,
        positionName: user.positionName ?? null,
        departmentId: user.departmentId ?? null,
        sectionId: user.sectionId ?? null,
        reviewGroupId: user.reviewGroupId ?? null,
        isActive: user.isActive
      }
    });
  }

  for (const account of fixture.localAccounts) {
    const password = account.password?.trim() || defaultLocalPassword;
    let passwordHash = passwordHashCache.get(password);

    if (!passwordHash) {
      passwordHash = await bcrypt.hash(password, 10);
      passwordHashCache.set(password, passwordHash);
    }

    await prisma.localAccount.create({
      data: {
        userId: account.userId,
        loginName: account.loginName.trim().toLowerCase(),
        passwordHash,
        localLoginEnabled: account.localLoginEnabled
      }
    });
  }

  for (const assignment of fixture.roleAssignments) {
    await prisma.userRoleAssignment.create({
      data: {
        id: assignment.id,
        userId: assignment.userId,
        roleCode: assignment.roleCode,
        scopeType: assignment.scopeType,
        scopeId: assignment.scopeId,
        isPrimary: assignment.isPrimary,
        isEnabled: assignment.isEnabled
      }
    });
  }

  for (const binding of fixture.sectionLeaderBindings) {
    await prisma.sectionLeaderBinding.create({
      data: {
        id: binding.id,
        leaderUserId: binding.leaderUserId,
        sectionId: binding.sectionId
      }
    });
  }

  for (const binding of fixture.groupLeaderBindings) {
    await prisma.groupLeaderBinding.create({
      data: {
        id: binding.id,
        leaderUserId: binding.leaderUserId,
        reviewGroupId: binding.reviewGroupId
      }
    });
  }

  for (const template of fixture.goalTemplates) {
    await createGoalTemplate(prisma, template);
  }
}

async function createGoalTemplate(prisma: PrismaClient, template: GoalTemplateFixture) {
  await prisma.goalTemplate.create({
    data: {
      id: template.id,
      departmentId: template.departmentId,
      name: template.name,
      description: template.description ?? null,
      isActive: template.isActive
    }
  });

  for (const keyResult of template.keyResults) {
    await prisma.goalTemplateKeyResult.create({
      data: {
        id: keyResult.id,
        goalTemplateId: template.id,
        code: keyResult.code,
        name: keyResult.name,
        description: keyResult.description ?? null,
        points: keyResult.points,
        scoreType: keyResult.scoreType ?? 'objective'
      }
    });
  }
}

async function seedScenarioGoals(prisma: PrismaClient, proofStorageRoot: string) {
  const [chen, yang, pu, pan] = await Promise.all([
    requireUserByName(prisma, ACTOR_NAMES.employeeLeader),
    requireUserByName(prisma, ACTOR_NAMES.topRankEmployee),
    requireUserByName(prisma, ACTOR_NAMES.secondRankEmployee),
    requireUserByName(prisma, ACTOR_NAMES.outOfScopeEmployee)
  ]);

  await prisma.user.update({
    where: { id: chen.id },
    data: {
      wecomUserId: '1700066'
    }
  });

  await mkdir(proofStorageRoot, { recursive: true });

  await createGoal(prisma, {
    ownerUserId: chen.id,
    year: 2026,
    quarter: 1,
    code: 'O1',
    name: '陈美果 2026 年一季度重点项目推进',
    description: '围绕数字业务中心一季度重点工作推进系统建设、知识沉淀和问题闭环。',
    status: 'confirmed',
    totalPoints: 70,
    keyResults: [
      {
        code: 'KR1',
        name: '完成季度方案交付与验收',
        description: '输出方案文档、验收纪要和版本交付记录。',
        points: 30,
        completionState: 'completed',
        reviewScore: 26.5,
        reviewComment: '交付节奏稳定，验收材料完整。',
        reviewedAt: QUARTER_START.q1,
        proofs: [
          {
            fileName: '一季度交付清单.xlsx',
            storageKey: 'seed-chen-q1-okr-o1-kr1.xlsx',
            note: '系统交付清单',
            content: 'quarter-delivery-checklist'
          }
        ]
      },
      {
        code: 'KR2',
        name: '沉淀关键业务流程知识',
        description: '完成高频流程的知识整理与场景说明。',
        points: 25,
        completionState: 'incomplete',
        reviewScore: 19.5,
        reviewComment: '核心内容已形成，但还缺少部分佐证。',
        reviewedAt: QUARTER_START.q1
      },
      {
        code: 'KR3',
        name: '推动重点问题闭环',
        description: '对接跨部门问题并形成闭环跟踪台账。',
        points: 15,
        completionState: 'incomplete',
        reviewScore: 12,
        reviewComment: '闭环效果明显，后续可继续提升时效。',
        reviewedAt: QUARTER_START.q1
      }
    ]
  }, proofStorageRoot);

  await createGoal(prisma, {
    ownerUserId: chen.id,
    year: 2026,
    quarter: 1,
    code: 'O2',
    name: '陈美果 一季度知识资产补充',
    description: '作为季度补充目标，完善文档模板、FAQ 和复盘材料。',
    status: 'confirmed',
    totalPoints: 20,
    keyResults: [
      {
        code: 'KR1',
        name: '补齐 FAQ 初版',
        description: '覆盖常见问题并形成统一答疑口径。',
        points: 10,
        completionState: 'incomplete',
        reviewScore: null,
        reviewComment: null,
        reviewedAt: null
      },
      {
        code: 'KR2',
        name: '整理季度复盘纪要',
        description: '汇总季度过程问题与复盘建议。',
        points: 5,
        completionState: 'incomplete',
        reviewScore: null,
        reviewComment: null,
        reviewedAt: null
      },
      {
        code: 'KR3',
        name: '完善材料模板',
        description: '沉淀可复用的证明材料模板。',
        points: 5,
        completionState: 'incomplete',
        reviewScore: null,
        reviewComment: null,
        reviewedAt: null
      }
    ]
  }, proofStorageRoot);

  await createGoal(prisma, {
    ownerUserId: chen.id,
    year: 2026,
    quarter: 2,
    code: 'O1',
    name: '陈美果 2026 年二季度目标',
    description: '用于年度评分汇总的二季度目标。',
    status: 'completed',
    totalPoints: 72,
    keyResults: [
      {
        code: 'KR1',
        name: '二季度核心任务达成',
        description: '完成季度核心事项。',
        points: 72,
        completionState: 'completed',
        reviewScore: 72,
        reviewComment: '二季度整体达成良好。',
        reviewedAt: QUARTER_START.q2,
        proofs: [
          {
            fileName: '二季度总结.pdf',
            storageKey: 'seed-chen-q2-okr-o1-kr1.pdf',
            note: '二季度复盘总结',
            content: 'chen-q2-summary'
          }
        ]
      }
    ]
  }, proofStorageRoot);

  await createScoredQuarterGoalSeries(prisma, proofStorageRoot, {
    ownerUserId: yang.id,
    ownerName: '杨增禄',
    baseName: '重点项目交付',
    scores: [92, 88, 90, 94],
    proofPrefix: 'yang'
  });

  await createScoredQuarterGoalSeries(prisma, proofStorageRoot, {
    ownerUserId: pu.id,
    ownerName: '蒲雪映',
    baseName: '业务协同优化',
    scores: [81, 79, 83, 80],
    proofPrefix: 'pu'
  });

  await createGoal(prisma, {
    ownerUserId: pan.id,
    year: 2026,
    quarter: 1,
    code: 'O1',
    name: '潘红 2026 年一季度运营支撑',
    description: '作为跨组员工样本，用于验证非评分范围可见但不可评分。',
    status: 'completed',
    totalPoints: 68,
    keyResults: [
      {
        code: 'KR1',
        name: '运营流程梳理',
        description: '完成重点运营流程梳理。',
        points: 40,
        completionState: 'completed',
        reviewScore: 38,
        reviewComment: '流程梳理完整。',
        reviewedAt: QUARTER_START.q1
      },
      {
        code: 'KR2',
        name: '服务质量跟踪',
        description: '完善运营服务质量跟踪台账。',
        points: 28,
        completionState: 'completed',
        reviewScore: 28,
        reviewComment: '服务质量稳定。',
        reviewedAt: QUARTER_START.q1,
        proofs: [
          {
            fileName: '运营台账.xlsx',
            storageKey: 'seed-pan-q1-okr-o1-kr2.xlsx',
            note: '运营跟踪台账',
            content: 'pan-q1-ops-proof'
          }
        ]
      }
    ]
  }, proofStorageRoot);
}

async function createScoredQuarterGoalSeries(
  prisma: PrismaClient,
  proofStorageRoot: string,
  input: {
    ownerUserId: string;
    ownerName: string;
    baseName: string;
    scores: [number, number, number, number];
    proofPrefix: string;
  }
) {
  const [q1, q2, q3, q4] = input.scores;

  await createGoal(prisma, {
    ownerUserId: input.ownerUserId,
    year: 2026,
    quarter: 1,
    code: 'O1',
    name: `${input.ownerName} 2026 年一季度${input.baseName}`,
    description: '年度演示数据的一季度样本。',
    status: 'completed',
    totalPoints: q1,
    keyResults: [
      {
        code: 'KR1',
        name: '完成季度核心事项',
        description: '完成季度内的核心交付。',
        points: q1,
        completionState: 'completed',
        reviewScore: q1,
        reviewComment: '季度目标已完成。',
        reviewedAt: QUARTER_START.q1,
        proofs: [
          {
            fileName: `${input.ownerName}一季度材料.pdf`,
            storageKey: `seed-${input.proofPrefix}-q1-proof.pdf`,
            note: '一季度证明材料',
            content: `${input.proofPrefix}-q1-proof`
          }
        ]
      }
    ]
  }, proofStorageRoot);

  await createGoal(prisma, {
    ownerUserId: input.ownerUserId,
    year: 2026,
    quarter: 2,
    code: 'O1',
    name: `${input.ownerName} 2026 年二季度${input.baseName}`,
    description: '年度演示数据的二季度样本。',
    status: 'completed',
    totalPoints: q2,
    keyResults: [
      {
        code: 'KR1',
        name: '完成季度核心事项',
        description: '完成季度内的核心交付。',
        points: q2,
        completionState: 'completed',
        reviewScore: q2,
        reviewComment: '季度目标已完成。',
        reviewedAt: QUARTER_START.q2
      }
    ]
  }, proofStorageRoot);

  await createGoal(prisma, {
    ownerUserId: input.ownerUserId,
    year: 2026,
    quarter: 3,
    code: 'O1',
    name: `${input.ownerName} 2026 年三季度${input.baseName}`,
    description: '年度演示数据的三季度样本。',
    status: 'completed',
    totalPoints: q3,
    keyResults: [
      {
        code: 'KR1',
        name: '完成季度核心事项',
        description: '完成季度内的核心交付。',
        points: q3,
        completionState: 'completed',
        reviewScore: q3,
        reviewComment: '季度目标已完成。',
        reviewedAt: QUARTER_START.q3
      }
    ]
  }, proofStorageRoot);

  await createGoal(prisma, {
    ownerUserId: input.ownerUserId,
    year: 2026,
    quarter: 4,
    code: 'O1',
    name: `${input.ownerName} 2026 年四季度${input.baseName}`,
    description: '年度演示数据的四季度样本。',
    status: 'completed',
    totalPoints: q4,
    keyResults: [
      {
        code: 'KR1',
        name: '完成季度核心事项',
        description: '完成季度内的核心交付。',
        points: q4,
        completionState: 'completed',
        reviewScore: q4,
        reviewComment: '季度目标已完成。',
        reviewedAt: QUARTER_START.q4
      }
    ]
  }, proofStorageRoot);
}

async function createGoal(
  prisma: PrismaClient,
  input: {
    ownerUserId: string;
    year: number;
    quarter: 1 | 2 | 3 | 4;
    code: string;
    name: string;
    description: string;
    status: 'draft' | 'confirmed' | 'pending-review' | 'completed';
    totalPoints: number;
    keyResults: Array<{
      code: string;
      name: string;
      description: string;
      points: number;
      completionState: 'incomplete' | 'completed';
      reviewScore: number | null;
      reviewComment: string | null;
      reviewedAt: Date | null;
      proofs?: Array<{
        fileName: string;
        storageKey: string;
        note: string;
        content: string;
      }>;
    }>;
  },
  proofStorageRoot: string
) {
  const goal = await prisma.goal.create({
    data: {
      ownerUserId: input.ownerUserId,
      year: input.year,
      quarter: input.quarter,
      code: input.code,
      name: input.name,
      description: input.description,
      status: input.status,
      totalPoints: input.totalPoints
    }
  });

  for (const keyResult of input.keyResults) {
    const createdKeyResult = await prisma.keyResult.create({
      data: {
        goalId: goal.id,
        code: keyResult.code,
        name: keyResult.name,
        description: keyResult.description,
        points: keyResult.points,
        scoreType: 'objective',
        completionState: keyResult.completionState,
        reviewScore: keyResult.reviewScore,
        reviewComment: keyResult.reviewComment,
        reviewedAt: keyResult.reviewedAt,
        reviewedByUserId: keyResult.reviewScore === null ? null : input.ownerUserId
      }
    });

    for (const proof of keyResult.proofs ?? []) {
      await createProof(prisma, createdKeyResult.id, proofStorageRoot, {
        ...proof,
        uploadedAt: keyResult.reviewedAt ?? QUARTER_START.q1
      });
    }
  }
}

async function createProof(
  prisma: PrismaClient,
  keyResultId: string,
  proofStorageRoot: string,
  input: {
    fileName: string;
    storageKey: string;
    note: string;
    content: string;
    uploadedAt: Date;
  }
) {
  const absolutePath = resolve(proofStorageRoot, input.storageKey);
  await mkdir(dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(input.content, 'utf8');
  await writeFile(absolutePath, buffer);

  await prisma.proof.create({
    data: {
      keyResultId,
      fileName: input.fileName,
      fileUrl: input.storageKey,
      fileSize: buffer.length,
      note: input.note,
      uploadedAt: input.uploadedAt
    }
  });
}

async function requireUserByName(prisma: PrismaClient, name: string) {
  const user = await prisma.user.findFirst({
    where: {
      name,
      isActive: true
    }
  });

  if (!user) {
    throw new Error(`Current demo seed missing required user: ${name}`);
  }

  return user;
}
