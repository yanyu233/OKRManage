import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { REVIEW_GRADE_CODES } from '../src/shared/constants/review-grade-codes';

loadEnv();
loadEnv({ path: '.env.local', override: false });

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
    password: null;
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
    quotas: Array<{
      gradeCode: string;
      seatCount: number;
    }>;
  }>;
  goalTemplates: Array<{
    id: string;
    departmentId: string;
    name: string;
    description?: string | null;
    isActive: boolean;
    keyResults: Array<{
      id: string;
      code: string;
      name: string;
      description?: string | null;
      points: number;
      scoreType: 'objective' | 'subjective';
    }>;
  }>;
};

const prisma = new PrismaClient();

async function main() {
  const fixturePath =
    process.env.OKR_CURRENT_BOOTSTRAP_FIXTURE_PATH?.trim() ||
    resolve(process.cwd(), 'test', 'fixtures', 'admin-bootstrap-current-demo.fixture.json');

  const [departments, sections, users, localAccounts, roleAssignments, sectionLeaderBindings, groupLeaderBindings, reviewGroups, goalTemplates] =
    await prisma.$transaction([
      prisma.department.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.section.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.user.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.localAccount.findMany({
        where: {
          user: {
            isActive: true
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.userRoleAssignment.findMany({
        where: {
          isEnabled: true,
          user: {
            isActive: true
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.sectionLeaderBinding.findMany({
        where: {
          leader: { isActive: true },
          section: { isActive: true }
        },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.groupLeaderBinding.findMany({
        where: {
          leader: { isActive: true },
          reviewGroup: { isActive: true }
        },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.reviewGroup.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        include: {
          quotas: {
            orderBy: { gradeCode: 'asc' }
          }
        }
      }),
      prisma.goalTemplate.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        include: {
          keyResults: {
            orderBy: { createdAt: 'asc' }
          }
        }
      })
    ]);

  const fixture: AdminBootstrapFixture = {
    departments: departments.map((department) => ({
      id: department.id,
      name: department.name,
      isActive: department.isActive
    })),
    sections: sections.map((section) => ({
      id: section.id,
      departmentId: section.departmentId,
      name: section.name,
      isActive: section.isActive
    })),
    users: users.map((user) => ({
      id: user.id,
      employeeNo: user.employeeNo,
      name: user.name,
      positionName: user.positionName,
      departmentId: user.departmentId,
      sectionId: user.sectionId,
      reviewGroupId: user.reviewGroupId,
      isActive: user.isActive
    })),
    localAccounts: localAccounts.map((account) => ({
      userId: account.userId,
      loginName: account.loginName,
      localLoginEnabled: account.localLoginEnabled,
      password: null
    })),
    roleAssignments: roleAssignments.map((assignment) => ({
      id: assignment.id,
      userId: assignment.userId,
      roleCode: assignment.roleCode,
      scopeType: assignment.scopeType,
      scopeId: assignment.scopeId,
      isPrimary: assignment.isPrimary,
      isEnabled: assignment.isEnabled
    })),
    sectionLeaderBindings: sectionLeaderBindings.map((binding) => ({
      id: binding.id,
      leaderUserId: binding.leaderUserId,
      sectionId: binding.sectionId
    })),
    groupLeaderBindings: groupLeaderBindings.map((binding) => ({
      id: binding.id,
      leaderUserId: binding.leaderUserId,
      reviewGroupId: binding.reviewGroupId
    })),
    reviewGroups: reviewGroups.map((reviewGroup) => ({
      id: reviewGroup.id,
      name: reviewGroup.name,
      isActive: reviewGroup.isActive,
      quotas: REVIEW_GRADE_CODES.map((gradeCode) => ({
        gradeCode,
        seatCount: reviewGroup.quotas.find((quota) => quota.gradeCode === gradeCode)?.seatCount ?? 0
      }))
    })),
    goalTemplates: goalTemplates.map((template) => ({
      id: template.id,
      departmentId: template.departmentId,
      name: template.name,
      description: template.description,
      isActive: template.isActive,
      keyResults: template.keyResults.map((keyResult) => ({
        id: keyResult.id,
        code: keyResult.code,
        name: keyResult.name,
        description: keyResult.description,
        points: keyResult.points,
        scoreType: keyResult.scoreType
      }))
    }))
  };

  await mkdir(dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        fixturePath,
        departmentCount: fixture.departments.length,
        sectionCount: fixture.sections.length,
        userCount: fixture.users.length,
        localAccountCount: fixture.localAccounts.length,
        reviewGroupCount: fixture.reviewGroups.length,
        goalTemplateCount: fixture.goalTemplates.length
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
