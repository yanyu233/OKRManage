import { randomUUID } from 'node:crypto';
import { basename, resolve } from 'node:path';
import * as ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

type ParsedEmployee = {
  name: string;
  rawPosition: string;
  positionName: string;
  sectionName: string;
  sheetName: string;
};

const prisma = new PrismaClient();
const TARGET_DEPARTMENT_NAME = '数字科技管理事业部';

async function main() {
  const sourceArg = process.argv[2]?.trim();
  if (!sourceArg) {
    throw new Error('usage: tsx scripts/import-score-sheet-employees.ts <xlsx-path>');
  }

  const sourcePath = resolve(process.cwd(), sourceArg);
  const department = await prisma.department.findFirst({
    where: {
      name: TARGET_DEPARTMENT_NAME,
      isActive: true
    },
    include: {
      sections: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!department) {
    throw new Error(`active department not found: ${TARGET_DEPARTMENT_NAME}`);
  }

  if (department.sections.length === 0) {
    throw new Error(`no active sections found under department: ${TARGET_DEPARTMENT_NAME}`);
  }

  const parsedEmployees = await parseEmployeesFromWorkbook(sourcePath, department.sections.map((section) => section.name));
  const sysadminUserIds = await listSystemAdminUserIds();
  const existingUsers = await prisma.user.findMany({
    where: {
      id: {
        notIn: sysadminUserIds
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  const existingByName = new Map<string, typeof existingUsers[number]>();
  for (const user of existingUsers) {
    if (existingByName.has(user.name)) {
      throw new Error(`duplicate existing user name found in database: ${user.name}`);
    }
    existingByName.set(user.name, user);
  }

  const sectionIdByName = new Map(department.sections.map((section) => [section.name, section.id]));
  let createdCount = 0;
  let updatedCount = 0;

  await prisma.$transaction(async (tx) => {
    const importedUserIds: string[] = [];

    for (const employee of parsedEmployees) {
      const existingUser = existingByName.get(employee.name);
      const sectionId = sectionIdByName.get(employee.sectionName);

      if (!sectionId) {
        throw new Error(`section not found for employee ${employee.name}: ${employee.sectionName}`);
      }

      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: employee.name,
            positionName: employee.positionName,
            departmentId: department.id,
            sectionId,
            reviewGroupId: existingUser.reviewGroupId,
            isActive: true
          }
        });
        importedUserIds.push(existingUser.id);
        updatedCount += 1;
        continue;
      }

      const createdUser = await tx.user.create({
        data: {
          employeeNo: null,
          name: employee.name,
          positionName: employee.positionName,
          wecomUserId: null,
          departmentId: department.id,
          sectionId,
          reviewGroupId: null,
          isActive: true
        }
      });
      importedUserIds.push(createdUser.id);
      createdCount += 1;
    }

    await tx.user.updateMany({
      where: {
        id: {
          notIn: [...sysadminUserIds, ...importedUserIds]
        },
        isActive: true
      },
      data: {
        isActive: false,
        departmentId: null,
        sectionId: null,
        reviewGroupId: null
      }
    });

    const existingAssignments = await tx.userRoleAssignment.findMany({
      where: {
        userId: {
          in: importedUserIds
        }
      },
      select: {
        id: true,
        userId: true,
        roleCode: true,
        scopeType: true,
        scopeId: true,
        isPrimary: true,
        isEnabled: true
      }
    });

    const enabledAssignmentsByUserId = new Map<string, typeof existingAssignments>();
    const existingEmployeeAssignmentsByUserId = new Map<string, (typeof existingAssignments)[number]>();

    for (const assignment of existingAssignments) {
      if (assignment.roleCode === 'employee' && assignment.scopeType === 'user' && assignment.scopeId === assignment.userId) {
        existingEmployeeAssignmentsByUserId.set(assignment.userId, assignment);
      }

      if (!assignment.isEnabled) {
        continue;
      }

      const current = enabledAssignmentsByUserId.get(assignment.userId);
      if (current) {
        current.push(assignment);
        continue;
      }

      enabledAssignmentsByUserId.set(assignment.userId, [assignment]);
    }

    for (const userId of importedUserIds) {
      const enabledAssignments = enabledAssignmentsByUserId.get(userId) ?? [];
      const existingEmployeeAssignment = existingEmployeeAssignmentsByUserId.get(userId);
      const hasPrimaryRole = enabledAssignments.some((assignment) => assignment.isPrimary);
      const assignmentId = existingEmployeeAssignment?.id ?? randomUUID();

      await tx.userRoleAssignment.upsert({
        where: {
          id: assignmentId
        },
        update: {
          userId,
          roleCode: 'employee',
          scopeType: 'user',
          scopeId: userId,
          isEnabled: true,
          isPrimary: hasPrimaryRole ? existingEmployeeAssignment?.isPrimary ?? false : true
        },
        create: {
          id: assignmentId,
          userId,
          roleCode: 'employee',
          scopeType: 'user',
          scopeId: userId,
          isEnabled: true,
          isPrimary: hasPrimaryRole ? existingEmployeeAssignment?.isPrimary ?? false : true
        }
      });
    }
  });

  const sectionCounts = parsedEmployees.reduce<Record<string, number>>((result, employee) => {
    result[employee.sectionName] = (result[employee.sectionName] ?? 0) + 1;
    return result;
  }, {});

  console.log(
    JSON.stringify(
      {
        file: basename(sourcePath),
        totalImported: parsedEmployees.length,
        createdCount,
        updatedCount,
        sectionCounts
      },
      null,
      2
    )
  );
}

async function listSystemAdminUserIds() {
  const assignments = await prisma.userRoleAssignment.findMany({
    where: {
      roleCode: 'system-admin',
      isEnabled: true
    },
    select: {
      userId: true
    }
  });

  return assignments.map((assignment) => assignment.userId);
}

async function parseEmployeesFromWorkbook(filePath: string, sectionNames: string[]): Promise<ParsedEmployee[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sortedSectionNames = [...sectionNames].sort((left, right) => right.length - left.length);
  const employees: ParsedEmployee[] = [];
  const seenNames = new Set<string>();

  for (const sheet of workbook.worksheets) {
    for (let rowIndex = 3; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const row = sheet.getRow(rowIndex);
      const sequence = readCellText(row.getCell(1));
      const name = readCellText(row.getCell(2));
      const rawPosition = readCellText(row.getCell(3));

      if (!sequence && !name && !rawPosition) {
        continue;
      }

      if (sequence === '平均分' || name === '平均分' || rawPosition === '平均分') {
        break;
      }

      if (!/^\d+$/.test(sequence)) {
        continue;
      }

      if (!name) {
        throw new Error(`missing employee name at sheet ${sheet.name} row ${rowIndex}`);
      }

      if (!rawPosition) {
        throw new Error(`missing position name for employee ${name} at sheet ${sheet.name} row ${rowIndex}`);
      }

      if (seenNames.has(name)) {
        throw new Error(`duplicate employee name found in workbook: ${name}`);
      }

      const sectionName = sortedSectionNames.find((section) => rawPosition.startsWith(section)) ?? sheet.name.trim();
      const positionName = rawPosition.startsWith(sectionName) ? rawPosition.slice(sectionName.length).trim() : rawPosition;

      employees.push({
        name,
        rawPosition,
        positionName: positionName || rawPosition,
        sectionName,
        sheetName: sheet.name.trim()
      });
      seenNames.add(name);
    }
  }

  return employees;
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

    if ('hyperlink' in value && typeof value.hyperlink === 'string') {
      return String(value.text ?? value.hyperlink).trim();
    }

    if ('error' in value && typeof value.error === 'string') {
      return value.error.trim();
    }
  }

  return String(value).trim();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
