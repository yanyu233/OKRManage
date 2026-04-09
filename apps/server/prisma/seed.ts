import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const GRADE_CODES = ['A+', 'A', 'B+', 'B', 'C'] as const;

async function main(): Promise<void> {
  const loginName = requiredEnv('DEBUG_SYSADMIN_LOGIN');
  const password = requiredEnv('DEBUG_SYSADMIN_PASSWORD');
  const sysadminName = requiredEnv('DEBUG_SYSADMIN_NAME');

  const passwordHash = await bcrypt.hash(password, 10);

  const department = await prisma.department.upsert({
    where: { name: '工业互联网中心' },
    update: { isActive: true },
    create: {
      name: '工业互联网中心',
      isActive: true
    }
  });

  const section = await prisma.section.upsert({
    where: {
      departmentId_name: {
        departmentId: department.id,
        name: '平台产品科'
      }
    },
    update: {
      isActive: true
    },
    create: {
      departmentId: department.id,
      name: '平台产品科',
      isActive: true
    }
  });

  const reviewGroup = await prisma.reviewGroup.upsert({
    where: { name: '信息化组' },
    update: { isActive: true },
    create: {
      name: '信息化组',
      isActive: true
    }
  });

  const user = await prisma.user.upsert({
    where: {
      employeeNo: 'DEBUG-SYSADMIN'
    },
    update: {
      name: sysadminName,
      departmentId: department.id,
      sectionId: section.id,
      reviewGroupId: reviewGroup.id,
      isActive: true
    },
    create: {
      employeeNo: 'DEBUG-SYSADMIN',
      name: sysadminName,
      departmentId: department.id,
      sectionId: section.id,
      reviewGroupId: reviewGroup.id,
      isActive: true
    }
  });

  await prisma.localAccount.upsert({
    where: { userId: user.id },
    update: {
      loginName,
      passwordHash,
      localLoginEnabled: true
    },
    create: {
      userId: user.id,
      loginName,
      passwordHash,
      localLoginEnabled: true
    }
  });

  await prisma.userRoleAssignment.upsert({
    where: {
      userId_roleCode_scopeType_scopeId: {
        userId: user.id,
        roleCode: 'system-admin',
        scopeType: 'system',
        scopeId: 'system'
      }
    },
    update: {
      isPrimary: true,
      isEnabled: true
    },
    create: {
      userId: user.id,
      roleCode: 'system-admin',
      scopeType: 'system',
      scopeId: 'system',
      isPrimary: true,
      isEnabled: true
    }
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
        seatCount: 0
      },
      create: {
        reviewGroupId: reviewGroup.id,
        gradeCode,
        seatCount: 0
      }
    });
  }
}

function requiredEnv(key: string): string {
  const value = process.env[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
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
