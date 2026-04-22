import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { PrismaOrgRepository } from '../src/infrastructure/repositories/org/prisma-org.repository';
import { AdminConfigService } from '../src/modules/admin-config/admin-config.service';
import { REVIEW_GRADE_CODES } from '../src/shared/constants/review-grade-codes';
import type { AuthUser } from '../src/shared/types/auth-user';

type ParsedEmployeeRow = {
  employeeNo: string;
  name: string;
  sectionName: string;
  positionName: string | null;
  reviewGroupName: string | null;
};

type ParsedSectionLeaderRow = {
  employeeNo: string;
  name: string;
  sectionName: string;
};

type ParsedGroupLeaderRow = {
  employeeNo: string;
  name: string;
  reviewGroupName: string;
};

type ImportedUserState = {
  id: string;
  employeeNo: string;
  name: string;
  positionName: string | null;
  sectionName: string | null;
  reviewGroupName: string | null;
  isEmployee: boolean;
  sectionLeaderOf: Set<string>;
  groupLeaderOf: Set<string>;
};

const DEFAULT_SOURCE_PATH = 'C:/Users/yanxi/Downloads/人员情况表.xlsx';
const TARGET_DEPARTMENT_NAME = '数字科技管理事业部';
const DEFAULT_LOCAL_PASSWORD = process.env.PERSONNEL_IMPORT_DEFAULT_PASSWORD?.trim() || 'Moutai123.';

loadEnv();
loadEnv({ path: '.env.local', override: false });

const prisma = new PrismaService();
const orgRepository = new PrismaOrgRepository(prisma);
const adminConfigService = new AdminConfigService(
  {} as never,
  orgRepository,
  prisma,
  {} as never,
  {
    write: async () => undefined
  } as never
);

async function main() {
  const workbookPath = resolve(process.cwd(), process.argv[2]?.trim() || DEFAULT_SOURCE_PATH);
  const current = await orgRepository.getAdminBootstrap();

  const systemAdminAssignment = current.roleAssignments.find(
    (assignment) => assignment.roleCode === 'system-admin' && assignment.isEnabled
  );
  if (!systemAdminAssignment) {
    throw new Error('system admin account not found');
  }

  const systemAdminUser = current.users.find((user) => user.id === systemAdminAssignment.userId);
  if (!systemAdminUser) {
    throw new Error('system admin user record not found');
  }

  const systemAdminAccounts = current.localAccounts.filter((account) => account.userId === systemAdminUser.id);
  const systemAdminRoles = current.roleAssignments.filter((assignment) => assignment.userId === systemAdminUser.id);

  const parsed = await parseWorkbook(workbookPath);
  const sectionNames = Array.from(
    new Set([...parsed.employees.map((item) => item.sectionName), ...parsed.sectionLeaders.map((item) => item.sectionName)])
  );
  const reviewGroupNames = Array.from(
    new Set(
      [
        ...parsed.employees.map((item) => item.reviewGroupName).filter((value): value is string => Boolean(value)),
        ...parsed.groupLeaders.map((item) => item.reviewGroupName)
      ].sort((left, right) => left.localeCompare(right, 'zh-CN'))
    )
  );

  const currentDepartment =
    current.departments.find((department) => department.name === TARGET_DEPARTMENT_NAME) ?? current.departments[0];
  const departmentId = currentDepartment?.id ?? randomUUID();

  const currentSectionsByName = new Map(current.sections.map((section) => [section.name, section]));
  const currentReviewGroupsByName = new Map(current.reviewGroups.map((group) => [group.name, group]));
  const currentUsersByEmployeeNo = new Map(
    current.users
      .filter((user): user is typeof user & { employeeNo: string } => Boolean(user.employeeNo))
      .map((user) => [user.employeeNo!, user])
  );

  const sectionIdByName = new Map(
    sectionNames.map((sectionName) => [sectionName, currentSectionsByName.get(sectionName)?.id ?? `section-${randomUUID()}`])
  );
  const reviewGroupIdByName = new Map(
    reviewGroupNames.map((groupName) => [groupName, currentReviewGroupsByName.get(groupName)?.id ?? `review-group-${randomUUID()}`])
  );

  const importedUsers = buildImportedUsers(parsed, currentUsersByEmployeeNo);
  const leaderOnlyUserIds = new Set<string>();

  const bootstrap = {
    departments: [
      {
        id: departmentId,
        name: TARGET_DEPARTMENT_NAME,
        isActive: true
      }
    ],
    sections: sectionNames.map((sectionName) => ({
      id: sectionIdByName.get(sectionName)!,
      departmentId,
      name: sectionName,
      isActive: true
    })),
    users: [
      {
        id: systemAdminUser.id,
        employeeNo: systemAdminUser.employeeNo,
        name: systemAdminUser.name,
        positionName: systemAdminUser.positionName,
        departmentId,
        sectionId: resolveSystemAdminSectionId(systemAdminUser.sectionId, systemAdminUser.sectionId ? current.sections.find((section) => section.id === systemAdminUser.sectionId)?.name ?? null : null, sectionIdByName),
        reviewGroupId: null,
        isActive: true
      },
      ...Array.from(importedUsers.values()).map((user) => {
        if (!user.isEmployee) {
          leaderOnlyUserIds.add(user.id);
        }

        return {
          id: user.id,
          employeeNo: user.employeeNo,
          name: user.name,
          positionName: user.positionName,
          departmentId,
          sectionId: user.sectionName ? sectionIdByName.get(user.sectionName) ?? null : null,
          reviewGroupId: user.reviewGroupName ? reviewGroupIdByName.get(user.reviewGroupName) ?? null : null,
          isActive: true
        };
      })
    ],
    localAccounts: [
      ...systemAdminAccounts.map((account) => ({
        userId: account.userId,
        loginName: account.loginName,
        localLoginEnabled: account.localLoginEnabled,
        password: null
      })),
      ...Array.from(importedUsers.values()).map((user) => ({
        userId: user.id,
        loginName: user.employeeNo.toLowerCase(),
        localLoginEnabled: true,
        password: DEFAULT_LOCAL_PASSWORD
      }))
    ],
    roleAssignments: [
      ...systemAdminRoles.map((assignment) => ({ ...assignment })),
      ...Array.from(importedUsers.values()).flatMap((user) => buildRoleAssignmentsForUser(user))
    ],
    sectionLeaderBindings: parsed.sectionLeaders.map((entry) => {
      const user = importedUsers.get(entry.employeeNo);
      if (!user) {
        throw new Error(`section leader not found in imported users: ${entry.employeeNo}/${entry.name}`);
      }

      return {
        id: randomUUID(),
        leaderUserId: user.id,
        sectionId: sectionIdByName.get(entry.sectionName) ?? ''
      };
    }),
    groupLeaderBindings: parsed.groupLeaders.map((entry) => {
      const user = importedUsers.get(entry.employeeNo);
      if (!user) {
        throw new Error(`group leader not found in imported users: ${entry.employeeNo}/${entry.name}`);
      }

      return {
        id: randomUUID(),
        leaderUserId: user.id,
        reviewGroupId: reviewGroupIdByName.get(entry.reviewGroupName) ?? ''
      };
    }),
    reviewGroups: reviewGroupNames.map((groupName) => ({
      id: reviewGroupIdByName.get(groupName)!,
      name: groupName,
      isActive: true,
      quotas:
        currentReviewGroupsByName.get(groupName)?.quotas.map((quota) => ({ ...quota })) ??
        REVIEW_GRADE_CODES.map((gradeCode) => ({
          gradeCode,
          seatCount: 0
        }))
    })),
    goalTemplates: current.goalTemplates.map((template) => ({
      ...template,
      departmentId,
      keyResults: template.keyResults.map((keyResult) => ({ ...keyResult }))
    }))
  };

  const actor: AuthUser = {
    id: systemAdminUser.id,
    name: systemAdminUser.name,
    role: 'system-admin',
    activeRole: 'system-admin',
    roles: [{ role: 'system-admin', isPrimary: true }],
    loginName: systemAdminAccounts[0]?.loginName ?? 'sysadmin.local'
  };

  await prisma.$transaction(async (transaction) => {
    await transaction.user.deleteMany({
      where: {
        id: {
          not: systemAdminUser.id
        }
      }
    });
  });

  await adminConfigService.saveBootstrap(bootstrap, actor);

  if (leaderOnlyUserIds.size > 0) {
    await prisma.userRoleAssignment.updateMany({
      where: {
        userId: {
          in: Array.from(leaderOnlyUserIds)
        },
        roleCode: 'employee'
      },
      data: {
        isEnabled: false,
        isPrimary: false
      }
    });
  }

  const summary = {
    workbookPath,
    defaultLocalPassword: DEFAULT_LOCAL_PASSWORD,
    employeeCount: parsed.employees.length,
    sectionLeaderCount: parsed.sectionLeaders.length,
    groupLeaderCount: parsed.groupLeaders.length,
    importedUserCount: importedUsers.size,
    leaderOnlyUserCount: leaderOnlyUserIds.size,
    sectionCount: sectionNames.length,
    reviewGroupCount: reviewGroupNames.length
  };

  console.log(JSON.stringify(summary, null, 2));
}

function buildImportedUsers(
  parsed: { employees: ParsedEmployeeRow[]; sectionLeaders: ParsedSectionLeaderRow[]; groupLeaders: ParsedGroupLeaderRow[] },
  currentUsersByEmployeeNo: Map<string, { id: string }>
) {
  const users = new Map<string, ImportedUserState>();

  for (const employee of parsed.employees) {
    const existing = users.get(employee.employeeNo);
    if (existing) {
      throw new Error(`duplicate employeeNo in employee sheet: ${employee.employeeNo}`);
    }

    users.set(employee.employeeNo, {
      id: currentUsersByEmployeeNo.get(employee.employeeNo)?.id ?? `user-${randomUUID()}`,
      employeeNo: employee.employeeNo,
      name: employee.name,
      positionName: employee.positionName,
      sectionName: employee.sectionName,
      reviewGroupName: employee.reviewGroupName,
      isEmployee: true,
      sectionLeaderOf: new Set<string>(),
      groupLeaderOf: new Set<string>()
    });
  }

  for (const leader of parsed.sectionLeaders) {
    const current = users.get(leader.employeeNo);
    if (current) {
      current.sectionLeaderOf.add(leader.sectionName);
      if (!current.sectionName) {
        current.sectionName = leader.sectionName;
      }
      continue;
    }

    users.set(leader.employeeNo, {
      id: currentUsersByEmployeeNo.get(leader.employeeNo)?.id ?? `user-${randomUUID()}`,
      employeeNo: leader.employeeNo,
      name: leader.name,
      positionName: '科室负责人',
      sectionName: leader.sectionName,
      reviewGroupName: null,
      isEmployee: false,
      sectionLeaderOf: new Set([leader.sectionName]),
      groupLeaderOf: new Set<string>()
    });
  }

  for (const leader of parsed.groupLeaders) {
    const current = users.get(leader.employeeNo);
    if (current) {
      current.groupLeaderOf.add(leader.reviewGroupName);
      if (!current.reviewGroupName) {
        current.reviewGroupName = leader.reviewGroupName;
      }
      continue;
    }

    users.set(leader.employeeNo, {
      id: currentUsersByEmployeeNo.get(leader.employeeNo)?.id ?? `user-${randomUUID()}`,
      employeeNo: leader.employeeNo,
      name: leader.name,
      positionName: '小组负责人',
      sectionName: null,
      reviewGroupName: leader.reviewGroupName,
      isEmployee: false,
      sectionLeaderOf: new Set<string>(),
      groupLeaderOf: new Set([leader.reviewGroupName])
    });
  }

  return users;
}

function buildRoleAssignmentsForUser(user: ImportedUserState) {
  const hasSectionLeaderRole = user.sectionLeaderOf.size > 0;
  const hasGroupLeaderRole = user.groupLeaderOf.size > 0;
  const primaryRole = hasSectionLeaderRole ? 'section-leader' : hasGroupLeaderRole ? 'group-leader' : 'employee';
  const assignments: Array<{
    id: string;
    userId: string;
    roleCode: 'employee' | 'section-leader' | 'group-leader';
    scopeType: 'user' | 'section' | 'review-group';
    scopeId: string;
    isPrimary: boolean;
    isEnabled: boolean;
  }> = [];

  if (user.isEmployee) {
    assignments.push({
      id: randomUUID(),
      userId: user.id,
      roleCode: 'employee',
      scopeType: 'user',
      scopeId: user.id,
      isPrimary: primaryRole === 'employee',
      isEnabled: true
    });
  }

  if (hasSectionLeaderRole) {
    assignments.push({
      id: randomUUID(),
      userId: user.id,
      roleCode: 'section-leader',
      scopeType: 'section',
      scopeId: `managed-section:${user.id}`,
      isPrimary: primaryRole === 'section-leader',
      isEnabled: true
    });
  }

  if (hasGroupLeaderRole) {
    assignments.push({
      id: randomUUID(),
      userId: user.id,
      roleCode: 'group-leader',
      scopeType: 'review-group',
      scopeId: `managed-group:${user.id}`,
      isPrimary: primaryRole === 'group-leader',
      isEnabled: true
    });
  }

  return assignments;
}

function resolveSystemAdminSectionId(
  currentSectionId: string | null | undefined,
  currentSectionName: string | null,
  sectionIdByName: Map<string, string>
) {
  if (!currentSectionId) {
    return null;
  }

  if (currentSectionName && sectionIdByName.has(currentSectionName)) {
    return sectionIdByName.get(currentSectionName) ?? null;
  }

  return null;
}

async function parseWorkbook(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const employeeSheet = workbook.getWorksheet('Sheet1');
  const sectionLeaderSheet = workbook.getWorksheet('Sheet2');
  const groupLeaderSheet = workbook.getWorksheet('Sheet3');

  if (!employeeSheet || !sectionLeaderSheet || !groupLeaderSheet) {
    throw new Error('人员情况表缺少 Sheet1 / Sheet2 / Sheet3');
  }

  const employees: ParsedEmployeeRow[] = [];
  for (let rowIndex = 3; rowIndex <= employeeSheet.rowCount; rowIndex += 1) {
    const row = employeeSheet.getRow(rowIndex);
    const name = readCellText(row.getCell(2));
    const employeeNo = readCellText(row.getCell(3));
    const sectionName = readCellText(row.getCell(4));
    const positionName = readCellText(row.getCell(5));
    const rawReviewGroupName = readCellText(row.getCell(6));

    if (!name && !employeeNo && !sectionName && !positionName && !rawReviewGroupName) {
      continue;
    }

    if (!name || !employeeNo || !sectionName) {
      throw new Error(`employee sheet row ${rowIndex} is incomplete`);
    }

    employees.push({
      employeeNo,
      name,
      sectionName,
      positionName: positionName || null,
      reviewGroupName: normalizeReviewGroupName(rawReviewGroupName)
    });
  }

  const sectionLeaders: ParsedSectionLeaderRow[] = [];
  for (let rowIndex = 2; rowIndex <= sectionLeaderSheet.rowCount; rowIndex += 1) {
    const row = sectionLeaderSheet.getRow(rowIndex);
    const sectionName = readCellText(row.getCell(1));
    const name = readCellText(row.getCell(2));
    const employeeNo = readCellText(row.getCell(3));

    if (!sectionName && !name && !employeeNo) {
      continue;
    }

    if (!sectionName || !name || !employeeNo) {
      throw new Error(`section leader sheet row ${rowIndex} is incomplete`);
    }

    sectionLeaders.push({
      employeeNo,
      name,
      sectionName
    });
  }

  const groupLeaders: ParsedGroupLeaderRow[] = [];
  for (let rowIndex = 2; rowIndex <= groupLeaderSheet.rowCount; rowIndex += 1) {
    const row = groupLeaderSheet.getRow(rowIndex);
    const reviewGroupName = normalizeReviewGroupName(readCellText(row.getCell(1)));
    const name = readCellText(row.getCell(2));
    const employeeNo = readCellText(row.getCell(3));

    if (!reviewGroupName && !name && !employeeNo) {
      continue;
    }

    if (!reviewGroupName || !name || !employeeNo) {
      throw new Error(`group leader sheet row ${rowIndex} is incomplete`);
    }

    groupLeaders.push({
      employeeNo,
      name,
      reviewGroupName
    });
  }

  return {
    employees,
    sectionLeaders,
    groupLeaders
  };
}

function normalizeReviewGroupName(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized === '/') {
    return null;
  }

  return normalized;
}

function readCellText(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value == null) {
    return '';
  }

  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((entry) => entry.text ?? '').join('').trim();
    }

    if ('text' in value && typeof value.text === 'string') {
      return value.text.trim();
    }

    if ('result' in value && value.result != null) {
      return String(value.result).trim();
    }
  }

  return String(value).trim();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
