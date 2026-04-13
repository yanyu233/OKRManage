import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { REVIEW_GRADE_CODES, type ReviewGradeCode } from '../../shared/constants/review-grade-codes';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';
import { type AuthUser } from '../../shared/types/auth-user';
import { type AdminOrgBootstrap, type AdminOrgBootstrapInput, type ScoreTypeRecord } from '../../infrastructure/repositories/org/org.repository';
import { AdminConfigService } from './admin-config.service';

const SHEETS = {
  guide: '说明',
  departments: '部门',
  sections: '科室',
  users: '员工',
  localAccounts: '本地账号',
  roleAssignments: '角色分配',
  sectionLeaders: '科室负责人绑定',
  groupLeaders: '小组负责人绑定',
  reviewGroups: '评价组',
  reviewGroupQuotas: '评价组名额',
  goalTemplates: '模板目标',
  goalTemplateKeyResults: '模板关键结果'
} as const;

@Injectable()
export class AdminConfigExcelService {
  constructor(private readonly adminConfigService: AdminConfigService) {}

  async exportWorkbook(): Promise<Buffer> {
    const bootstrap = await this.adminConfigService.getBootstrap();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OKR Route C';
    workbook.created = new Date();

    this.addGuideSheet(workbook);
    this.addDepartmentsSheet(workbook, bootstrap);
    this.addSectionsSheet(workbook, bootstrap);
    this.addUsersSheet(workbook, bootstrap);
    this.addLocalAccountsSheet(workbook, bootstrap);
    this.addRoleAssignmentsSheet(workbook, bootstrap);
    this.addSectionLeaderBindingsSheet(workbook, bootstrap);
    this.addGroupLeaderBindingsSheet(workbook, bootstrap);
    this.addReviewGroupsSheet(workbook, bootstrap);
    this.addReviewGroupQuotasSheet(workbook, bootstrap);
    this.addGoalTemplatesSheet(workbook, bootstrap);
    this.addGoalTemplateKeyResultsSheet(workbook, bootstrap);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  }

  async importWorkbook(buffer: Buffer, actor: AuthUser) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const current = await this.adminConfigService.getBootstrap();
    const next = this.toBootstrapInput(current);

    const departmentsRows = this.readRows(workbook.getWorksheet(SHEETS.departments), [2, 3]);
    if (departmentsRows.length > 0) {
      next.departments = departmentsRows.map((row) => ({
        id: this.readString(row, 1) || randomUUID(),
        name: this.requiredString(row, 2, '部门名称'),
        isActive: this.readBoolean(row, 3, true)
      }));
    }

    const sectionsRows = this.readRows(workbook.getWorksheet(SHEETS.sections), [3, 4, 5]);
    if (sectionsRows.length > 0) {
      next.sections = sectionsRows.map((row) => ({
        id: this.readString(row, 1) || randomUUID(),
        departmentId: this.resolveReferenceId({
          idValue: this.readString(row, 2),
          nameValue: this.requiredString(row, 3, '所属部门'),
          items: next.departments,
          label: '所属部门'
        }),
        name: this.requiredString(row, 4, '科室名称'),
        isActive: this.readBoolean(row, 5, true)
      }));
    }

    const reviewGroupRows = this.readRows(workbook.getWorksheet(SHEETS.reviewGroups), [2, 3]);
    const reviewGroupQuotaRows = this.readRows(workbook.getWorksheet(SHEETS.reviewGroupQuotas), [2, 3, 4, 5, 6, 7]);
    if (reviewGroupRows.length > 0 || reviewGroupQuotaRows.length > 0) {
      const baseGroups = reviewGroupRows.length > 0
        ? reviewGroupRows.map((row) => ({
            id: this.readString(row, 1) || randomUUID(),
            name: this.requiredString(row, 2, '评价组名称'),
            isActive: this.readBoolean(row, 3, true),
            quotas: REVIEW_GRADE_CODES.map((gradeCode) => ({ gradeCode, seatCount: 0 }))
          }))
        : next.reviewGroups.map((entry) => ({
            ...entry,
            quotas: entry.quotas.map((quota) => ({ ...quota }))
          }));

      const groupsById = new Map(baseGroups.map((entry) => [entry.id, entry]));
      const groupsByName = new Map(baseGroups.map((entry) => [entry.name.trim().toLowerCase(), entry]));

      for (const row of reviewGroupQuotaRows) {
        const group = this.resolveReference({
          idValue: this.readString(row, 1),
          nameValue: this.requiredString(row, 2, '评价组名称'),
          byId: groupsById,
          byName: groupsByName,
          label: '评价组'
        });

        group.quotas = REVIEW_GRADE_CODES.map((gradeCode, index) => ({
          gradeCode,
          seatCount: this.readInteger(row, index + 3)
        }));
      }

      next.reviewGroups = baseGroups;
    }

    const usersRows = this.readRows(workbook.getWorksheet(SHEETS.users), [2, 3, 5, 7, 9, 10]);
    if (usersRows.length > 0) {
      next.users = usersRows.map((row) => ({
        id: this.readString(row, 1) || randomUUID(),
        employeeNo: this.readString(row, 2) || null,
        name: this.requiredString(row, 3, '员工姓名'),
        departmentId: this.resolveOptionalReferenceId({
          idValue: this.readString(row, 4),
          nameValue: this.readString(row, 5),
          items: next.departments,
          label: '所属部门'
        }),
        sectionId: this.resolveOptionalReferenceId({
          idValue: this.readString(row, 6),
          nameValue: this.readString(row, 7),
          items: next.sections,
          label: '所属科室'
        }),
        reviewGroupId: this.resolveOptionalReferenceId({
          idValue: this.readString(row, 8),
          nameValue: this.readString(row, 9),
          items: next.reviewGroups,
          label: '所属评价组'
        }),
        isActive: this.readBoolean(row, 10, true)
      }));
    }

    const localAccountRows = this.readRows(workbook.getWorksheet(SHEETS.localAccounts), [2, 3, 4, 5]);
    if (localAccountRows.length > 0) {
      next.localAccounts = localAccountRows.map((row) => ({
        userId: this.resolveReferenceId({
          idValue: this.readString(row, 1),
          nameValue: this.requiredString(row, 2, '关联员工'),
          items: next.users,
          label: '关联员工'
        }),
        loginName: this.requiredString(row, 3, '登录名'),
        localLoginEnabled: this.readBoolean(row, 4, true),
        password: this.readString(row, 5) || null
      }));
    }

    const roleAssignmentRows = this.readRows(workbook.getWorksheet(SHEETS.roleAssignments), [3, 4, 5, 6, 7]);
    if (roleAssignmentRows.length > 0) {
      next.roleAssignments = roleAssignmentRows.map((row) => ({
        id: this.readString(row, 1) || randomUUID(),
        userId: this.resolveReferenceId({
          idValue: this.readString(row, 2),
          nameValue: this.requiredString(row, 3, '关联员工'),
          items: next.users,
          label: '关联员工'
        }),
        roleCode: this.parseRoleCode(this.readString(row, 4) || this.requiredString(row, 5, '角色')),
        scopeType: 'user',
        scopeId: '',
        isPrimary: this.readBoolean(row, 6, false),
        isEnabled: this.readBoolean(row, 7, true)
      }));
    }

    const sectionLeaderRows = this.readRows(workbook.getWorksheet(SHEETS.sectionLeaders), [3, 5]);
    if (sectionLeaderRows.length > 0) {
      next.sectionLeaderBindings = sectionLeaderRows.map((row) => ({
        id: this.readString(row, 1) || randomUUID(),
        leaderUserId: this.resolveReferenceId({
          idValue: this.readString(row, 2),
          nameValue: this.requiredString(row, 3, '负责人'),
          items: next.users,
          label: '负责人'
        }),
        sectionId: this.resolveReferenceId({
          idValue: this.readString(row, 4),
          nameValue: this.requiredString(row, 5, '科室'),
          items: next.sections,
          label: '科室'
        })
      }));
    }

    const groupLeaderRows = this.readRows(workbook.getWorksheet(SHEETS.groupLeaders), [3, 5]);
    if (groupLeaderRows.length > 0) {
      next.groupLeaderBindings = groupLeaderRows.map((row) => ({
        id: this.readString(row, 1) || randomUUID(),
        leaderUserId: this.resolveReferenceId({
          idValue: this.readString(row, 2),
          nameValue: this.requiredString(row, 3, '负责人'),
          items: next.users,
          label: '负责人'
        }),
        reviewGroupId: this.resolveReferenceId({
          idValue: this.readString(row, 4),
          nameValue: this.requiredString(row, 5, '评价组'),
          items: next.reviewGroups,
          label: '评价组'
        })
      }));
    }

    const goalTemplateRows = this.readRows(workbook.getWorksheet(SHEETS.goalTemplates), [3, 4, 5, 6]);
    const keyResultRows = this.readRows(workbook.getWorksheet(SHEETS.goalTemplateKeyResults), [2, 4, 5, 6, 7, 8]);
    if (goalTemplateRows.length > 0 || keyResultRows.length > 0) {
      const templateRows = goalTemplateRows.length > 0 ? goalTemplateRows : next.goalTemplates.map((template) => ({
        getCell: (index: number) => ({
          text: this.toTemplateRowValue(template, index)
        })
      })) as unknown as ExcelJS.Row[];

      const templates = templateRows.map((row) => ({
        id: this.readString(row, 1) || randomUUID(),
        departmentId: this.resolveReferenceId({
          idValue: this.readString(row, 2),
          nameValue: this.requiredString(row, 3, '所属部门'),
          items: next.departments,
          label: '所属部门'
        }),
        name: this.requiredString(row, 4, '模板名称'),
        description: this.readString(row, 5) || null,
        isActive: this.readBoolean(row, 6, true),
        keyResults: [] as AdminOrgBootstrapInput['goalTemplates'][number]['keyResults']
      }));

      const templatesById = new Map(templates.map((entry) => [entry.id, entry]));
      const templatesByName = new Map(templates.map((entry) => [entry.name.trim().toLowerCase(), entry]));

      for (const row of keyResultRows) {
        const template = this.resolveReference({
          idValue: this.readString(row, 1),
          nameValue: this.requiredString(row, 2, '模板名称'),
          byId: templatesById,
          byName: templatesByName,
          label: '模板目标'
        });

        template.keyResults.push({
          id: this.readString(row, 3) || randomUUID(),
          code: this.requiredString(row, 4, '关键结果编号'),
          name: this.requiredString(row, 5, '关键结果名称'),
          description: this.readString(row, 6) || null,
          points: this.readInteger(row, 7),
          scoreType: this.parseScoreType(this.readString(row, 8))
        });
      }

      next.goalTemplates = templates;
    }

    const reconciled = this.reconcileBootstrapIds(next, current);

    return this.adminConfigService.saveBootstrap(reconciled, actor);
  }

  private toBootstrapInput(bootstrap: AdminOrgBootstrap): AdminOrgBootstrapInput {
    return {
      departments: bootstrap.departments.map((entry) => ({ ...entry })),
      sections: bootstrap.sections.map((entry) => ({ ...entry })),
      users: bootstrap.users.map((entry) => ({ ...entry })),
      localAccounts: bootstrap.localAccounts.map((entry) => ({ ...entry, password: null })),
      roleAssignments: bootstrap.roleAssignments.map((entry) => ({ ...entry })),
      sectionLeaderBindings: bootstrap.sectionLeaderBindings.map((entry) => ({ ...entry })),
      groupLeaderBindings: bootstrap.groupLeaderBindings.map((entry) => ({ ...entry })),
      reviewGroups: bootstrap.reviewGroups.map((entry) => ({
        id: entry.id,
        name: entry.name,
        isActive: entry.isActive,
        quotas: entry.quotas.map((quota) => ({ ...quota }))
      })),
      goalTemplates: bootstrap.goalTemplates.map((entry) => ({
        ...entry,
        keyResults: entry.keyResults.map((keyResult) => ({ ...keyResult }))
      }))
    };
  }

  private reconcileBootstrapIds(
    input: AdminOrgBootstrapInput,
    current: AdminOrgBootstrap
  ): AdminOrgBootstrapInput {
    const departmentIdMap = new Map<string, string>();
    const sectionIdMap = new Map<string, string>();
    const reviewGroupIdMap = new Map<string, string>();
    const userIdMap = new Map<string, string>();

    const departmentsById = new Map(current.departments.map((entry) => [entry.id, entry]));
    const departmentsByName = new Map(current.departments.map((entry) => [entry.name.trim().toLowerCase(), entry]));

    input.departments = input.departments.map((department) => {
      const matched =
        departmentsById.get(department.id) ??
        departmentsByName.get(department.name.trim().toLowerCase());

      if (!matched) {
        return department;
      }

      if (department.id !== matched.id) {
        departmentIdMap.set(department.id, matched.id);
      }

      return {
        ...department,
        id: matched.id
      };
    });

    const sectionsById = new Map(current.sections.map((entry) => [entry.id, entry]));
    const sectionsByComposite = new Map(
      current.sections.map((entry) => [`${entry.departmentId}|${entry.name.trim().toLowerCase()}`, entry])
    );

    input.sections = input.sections.map((section) => {
      const nextDepartmentId = departmentIdMap.get(section.departmentId) ?? section.departmentId;
      const matched =
        sectionsById.get(section.id) ??
        sectionsByComposite.get(`${nextDepartmentId}|${section.name.trim().toLowerCase()}`);

      if (!matched) {
        return {
          ...section,
          departmentId: nextDepartmentId
        };
      }

      if (section.id !== matched.id) {
        sectionIdMap.set(section.id, matched.id);
      }

      return {
        ...section,
        id: matched.id,
        departmentId: matched.departmentId
      };
    });

    const reviewGroupsById = new Map(current.reviewGroups.map((entry) => [entry.id, entry]));
    const reviewGroupsByName = new Map(current.reviewGroups.map((entry) => [entry.name.trim().toLowerCase(), entry]));

    input.reviewGroups = input.reviewGroups.map((reviewGroup) => {
      const matched =
        reviewGroupsById.get(reviewGroup.id) ??
        reviewGroupsByName.get(reviewGroup.name.trim().toLowerCase());

      if (!matched) {
        return reviewGroup;
      }

      if (reviewGroup.id !== matched.id) {
        reviewGroupIdMap.set(reviewGroup.id, matched.id);
      }

      return {
        ...reviewGroup,
        id: matched.id
      };
    });

    const currentLocalAccountsByLogin = new Map(
      current.localAccounts.map((entry) => [entry.loginName.trim().toLowerCase(), entry])
    );
    const importedLocalAccountsByUserId = new Map(
      input.localAccounts.map((entry) => [entry.userId, entry])
    );
    const usersById = new Map(current.users.map((entry) => [entry.id, entry]));
    const usersByEmployeeNo = new Map(
      current.users
        .filter((entry) => entry.employeeNo)
        .map((entry) => [entry.employeeNo!.trim().toLowerCase(), entry])
    );
    const usersByName = this.createUniqueNameMap(current.users);

    input.users = input.users.map((user) => {
      const importedAccount = importedLocalAccountsByUserId.get(user.id);
      const matchedByLogin =
        importedAccount ? currentLocalAccountsByLogin.get(importedAccount.loginName.trim().toLowerCase()) : undefined;
      const matched =
        matchedByLogin
          ? usersById.get(matchedByLogin.userId)
          : usersById.get(user.id) ??
            (user.employeeNo ? usersByEmployeeNo.get(user.employeeNo.trim().toLowerCase()) : undefined) ??
            usersByName.get(user.name.trim().toLowerCase());

      const nextDepartmentId = user.departmentId ? departmentIdMap.get(user.departmentId) ?? user.departmentId : null;
      const nextSectionId = user.sectionId ? sectionIdMap.get(user.sectionId) ?? user.sectionId : null;
      const nextReviewGroupId = user.reviewGroupId ? reviewGroupIdMap.get(user.reviewGroupId) ?? user.reviewGroupId : null;

      if (!matched) {
        return {
          ...user,
          departmentId: nextDepartmentId,
          sectionId: nextSectionId,
          reviewGroupId: nextReviewGroupId
        };
      }

      if (user.id !== matched.id) {
        userIdMap.set(user.id, matched.id);
      }

      return {
        ...user,
        id: matched.id,
        departmentId: nextDepartmentId,
        sectionId: nextSectionId,
        reviewGroupId: nextReviewGroupId
      };
    });

    input.localAccounts = input.localAccounts.map((account) => ({
      ...account,
      userId: userIdMap.get(account.userId) ?? account.userId
    }));

    const currentRoleAssignmentsById = new Map(current.roleAssignments.map((entry) => [entry.id, entry]));
    const currentRoleAssignmentsByComposite = new Map(
      current.roleAssignments.map((entry) => [
        `${entry.userId}|${entry.roleCode}|${entry.scopeType}|${entry.scopeId}`,
        entry
      ])
    );

    input.roleAssignments = input.roleAssignments.map((assignment) => {
      const nextUserId = userIdMap.get(assignment.userId) ?? assignment.userId;
      const scopeType = assignment.roleCode === 'employee'
        ? 'user'
        : assignment.roleCode === 'system-admin'
          ? 'system'
          : assignment.roleCode === 'section-leader'
            ? 'section'
            : 'review-group';
      const scopeId = assignment.roleCode === 'employee'
        ? nextUserId
        : assignment.roleCode === 'system-admin'
          ? 'system'
          : assignment.roleCode === 'section-leader'
            ? `managed-section:${nextUserId}`
            : `managed-group:${nextUserId}`;
      const compositeKey = `${nextUserId}|${assignment.roleCode}|${scopeType}|${scopeId}`;
      const matched =
        currentRoleAssignmentsById.get(assignment.id) ??
        currentRoleAssignmentsByComposite.get(compositeKey);

      return {
        ...assignment,
        id: matched?.id ?? assignment.id,
        userId: nextUserId,
        scopeType,
        scopeId
      };
    });

    input.sectionLeaderBindings = input.sectionLeaderBindings.map((binding) => ({
      ...binding,
      leaderUserId: userIdMap.get(binding.leaderUserId) ?? binding.leaderUserId,
      sectionId: sectionIdMap.get(binding.sectionId) ?? binding.sectionId
    }));

    input.groupLeaderBindings = input.groupLeaderBindings.map((binding) => ({
      ...binding,
      leaderUserId: userIdMap.get(binding.leaderUserId) ?? binding.leaderUserId,
      reviewGroupId: reviewGroupIdMap.get(binding.reviewGroupId) ?? binding.reviewGroupId
    }));

    const currentTemplatesById = new Map(current.goalTemplates.map((entry) => [entry.id, entry]));
    const currentTemplatesByComposite = new Map(
      current.goalTemplates.map((entry) => [
        `${entry.departmentId}|${entry.name.trim().toLowerCase()}`,
        entry
      ])
    );

    input.goalTemplates = input.goalTemplates.map((template) => {
      const nextDepartmentId = departmentIdMap.get(template.departmentId) ?? template.departmentId;
      const matched =
        currentTemplatesById.get(template.id) ??
        currentTemplatesByComposite.get(`${nextDepartmentId}|${template.name.trim().toLowerCase()}`);

      const nextTemplateId = matched?.id ?? template.id;

      const existingTemplate = matched ?? currentTemplatesById.get(nextTemplateId);
      const existingKeyResultsById = new Map(existingTemplate?.keyResults.map((entry) => [entry.id, entry]) ?? []);
      const existingKeyResultsByCode = new Map(
        (existingTemplate?.keyResults ?? []).map((entry) => [entry.code.trim().toLowerCase(), entry])
      );

      return {
        ...template,
        id: nextTemplateId,
        departmentId: nextDepartmentId,
        keyResults: template.keyResults.map((keyResult) => {
          const matchedKeyResult =
            existingKeyResultsById.get(keyResult.id) ??
            existingKeyResultsByCode.get(keyResult.code.trim().toLowerCase());

          return {
            ...keyResult,
            id: matchedKeyResult?.id ?? keyResult.id
          };
        })
      };
    });

    return input;
  }

  private createUniqueNameMap<T extends { name: string }>(items: T[]) {
    const counts = new Map<string, number>();

    for (const item of items) {
      const key = item.name.trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const unique = new Map<string, T>();
    for (const item of items) {
      const key = item.name.trim().toLowerCase();
      if ((counts.get(key) ?? 0) === 1) {
        unique.set(key, item);
      }
    }

    return unique;
  }

  private addGuideSheet(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet(SHEETS.guide);
    sheet.columns = [
      { header: '模块', key: 'module', width: 22 },
      { header: '说明', key: 'description', width: 90 }
    ];
    sheet.addRows([
      ['导入原则', '支持单个总工作簿导入导出。只会更新存在有效数据的 sheet，缺失或空白 sheet 不会覆盖系统现有数据。'],
      ['关联字段', '所有关联字段同时提供隐藏 ID 与中文名称。导入时优先按 ID 命中，找不到时再按名称匹配。'],
      ['角色分配', '角色分配不再手工维护范围类型和范围，系统会在保存时自动推导。'],
      ['评价组名额', '如果某个评价组的总名额超过组内员工人数，整次导入会失败，不会落半套数据。'],
      ['模板目标', '模板目标和模板关键结果需要成对维护；模板关键结果 sheet 中每行都要关联到模板目标。']
    ]);
  }

  private addDepartmentsSheet(workbook: ExcelJS.Workbook, bootstrap: AdminOrgBootstrap) {
    this.addSheet(
      workbook,
      SHEETS.departments,
      ['部门ID', '部门名称', '启用'],
      ['系统内部隐藏 ID，导入时优先匹配', '必填，不能重复', '填写 是/否'],
      '维护公司部门主数据。可以增改停用，不建议直接改动既有 ID。',
      bootstrap.departments.map((entry) => [entry.id, entry.name, this.boolText(entry.isActive)]),
      [1]
    );
  }

  private addSectionsSheet(workbook: ExcelJS.Workbook, bootstrap: AdminOrgBootstrap) {
    const departmentsById = new Map(bootstrap.departments.map((entry) => [entry.id, entry.name]));
    this.addSheet(
      workbook,
      SHEETS.sections,
      ['科室ID', '所属部门ID', '所属部门', '科室名称', '启用'],
      ['系统内部隐藏 ID，导入时优先匹配', '隐藏辅助列', '必填，按名称也可匹配部门', '必填，不能重复', '填写 是/否'],
      '维护科室数据。科室必须绑定到部门；优先保留隐藏 ID，不手工改动更稳。',
      bootstrap.sections.map((entry) => [entry.id, entry.departmentId, departmentsById.get(entry.departmentId) ?? '', entry.name, this.boolText(entry.isActive)]),
      [1, 2]
    );
  }

  private addUsersSheet(workbook: ExcelJS.Workbook, bootstrap: AdminOrgBootstrap) {
    const departmentsById = new Map(bootstrap.departments.map((entry) => [entry.id, entry.name]));
    const sectionsById = new Map(bootstrap.sections.map((entry) => [entry.id, entry.name]));
    const reviewGroupsById = new Map(bootstrap.reviewGroups.map((entry) => [entry.id, entry.name]));
    this.addSheet(
      workbook,
      SHEETS.users,
      ['员工ID', '工号', '员工姓名', '所属部门ID', '所属部门', '所属科室ID', '所属科室', '所属评价组ID', '所属评价组', '启用'],
      ['系统内部隐藏 ID', '可选', '必填', '隐藏辅助列', '可选，按名称匹配', '隐藏辅助列', '可选，按名称匹配', '隐藏辅助列', '可选，按名称匹配', '填写 是/否'],
      '维护员工主数据。部门、科室、评价组都支持按名称匹配，但建议保留隐藏 ID。',
      bootstrap.users.map((entry) => [
        entry.id,
        entry.employeeNo ?? '',
        entry.name,
        entry.departmentId ?? '',
        entry.departmentId ? departmentsById.get(entry.departmentId) ?? '' : '',
        entry.sectionId ?? '',
        entry.sectionId ? sectionsById.get(entry.sectionId) ?? '' : '',
        entry.reviewGroupId ?? '',
        entry.reviewGroupId ? reviewGroupsById.get(entry.reviewGroupId) ?? '' : '',
        this.boolText(entry.isActive)
      ]),
      [1, 4, 6, 8]
    );
  }

  private addLocalAccountsSheet(workbook: ExcelJS.Workbook, bootstrap: AdminOrgBootstrap) {
    const usersById = new Map(bootstrap.users.map((entry) => [entry.id, entry.name]));
    this.addSheet(
      workbook,
      SHEETS.localAccounts,
      ['员工ID', '关联员工', '登录名', '启用本地登录', '重置密码'],
      ['隐藏辅助列', '必填，按名称匹配员工', '必填，登录名需唯一', '填写 是/否', '可选，留空表示保留原密码'],
      '少量兜底账号维护表。只会影响本地登录，不影响企业微信映射。',
      bootstrap.localAccounts.map((entry) => [entry.userId, usersById.get(entry.userId) ?? '', entry.loginName, this.boolText(entry.localLoginEnabled), '']),
      [1]
    );
  }

  private addRoleAssignmentsSheet(workbook: ExcelJS.Workbook, bootstrap: AdminOrgBootstrap) {
    const usersById = new Map(bootstrap.users.map((entry) => [entry.id, entry.name]));
    this.addSheet(
      workbook,
      SHEETS.roleAssignments,
      ['角色分配ID', '员工ID', '关联员工', '角色代码', '角色', '主角色', '启用'],
      ['系统内部隐藏 ID', '隐藏辅助列', '必填，按名称匹配员工', '可选，保留代码更稳', '必填，可填写 系统管理员/科室负责人/小组负责人/员工', '填写 是/否', '填写 是/否'],
      '维护员工角色。范围类型和范围会在保存时自动推导，不需要在 Excel 里维护。',
      bootstrap.roleAssignments.map((entry) => [entry.id, entry.userId, usersById.get(entry.userId) ?? '', entry.roleCode, this.roleLabel(entry.roleCode), this.boolText(entry.isPrimary), this.boolText(entry.isEnabled)]),
      [1, 2, 4]
    );
  }

  private addSectionLeaderBindingsSheet(workbook: ExcelJS.Workbook, bootstrap: AdminOrgBootstrap) {
    const usersById = new Map(bootstrap.users.map((entry) => [entry.id, entry.name]));
    const sectionsById = new Map(bootstrap.sections.map((entry) => [entry.id, entry.name]));
    this.addSheet(
      workbook,
      SHEETS.sectionLeaders,
      ['绑定ID', '负责人ID', '负责人', '科室ID', '科室'],
      ['系统内部隐藏 ID', '隐藏辅助列', '必填，按名称匹配员工', '隐藏辅助列', '必填，按名称匹配科室'],
      '配置科室负责人绑定。负责人可查看所有 OKR，但评分权限按这里的绑定收口。',
      bootstrap.sectionLeaderBindings.map((entry) => [entry.id, entry.leaderUserId, usersById.get(entry.leaderUserId) ?? '', entry.sectionId, sectionsById.get(entry.sectionId) ?? '']),
      [1, 2, 4]
    );
  }

  private addGroupLeaderBindingsSheet(workbook: ExcelJS.Workbook, bootstrap: AdminOrgBootstrap) {
    const usersById = new Map(bootstrap.users.map((entry) => [entry.id, entry.name]));
    const reviewGroupsById = new Map(bootstrap.reviewGroups.map((entry) => [entry.id, entry.name]));
    this.addSheet(
      workbook,
      SHEETS.groupLeaders,
      ['绑定ID', '负责人ID', '负责人', '评价组ID', '评价组'],
      ['系统内部隐藏 ID', '隐藏辅助列', '必填，按名称匹配员工', '隐藏辅助列', '必填，按名称匹配评价组'],
      '配置小组负责人绑定。小组负责人可查看所有 OKR，但评分权限按这里的绑定收口。',
      bootstrap.groupLeaderBindings.map((entry) => [entry.id, entry.leaderUserId, usersById.get(entry.leaderUserId) ?? '', entry.reviewGroupId, reviewGroupsById.get(entry.reviewGroupId) ?? '']),
      [1, 2, 4]
    );
  }

  private addReviewGroupsSheet(workbook: ExcelJS.Workbook, bootstrap: AdminOrgBootstrap) {
    this.addSheet(
      workbook,
      SHEETS.reviewGroups,
      ['评价组ID', '评价组名称', '启用'],
      ['系统内部隐藏 ID', '必填，不能重复', '填写 是/否'],
      '维护评价组主数据。名额请在“评价组名额”sheet 里维护。',
      bootstrap.reviewGroups.map((entry) => [entry.id, entry.name, this.boolText(entry.isActive)]),
      [1]
    );
  }

  private addReviewGroupQuotasSheet(workbook: ExcelJS.Workbook, bootstrap: AdminOrgBootstrap) {
    this.addSheet(
      workbook,
      SHEETS.reviewGroupQuotas,
      ['评价组ID', '评价组名称', 'A+', 'A', 'B', 'C', 'D'],
      ['隐藏辅助列', '必填，按名称匹配评价组', '非负整数', '非负整数', '非负整数', '非负整数', '非负整数'],
      '维护评价组档位名额。总名额不能超过当前组内启用员工人数，否则导入和保存都会失败。',
      bootstrap.reviewGroups.map((entry) => [entry.id, entry.name, ...REVIEW_GRADE_CODES.map((gradeCode) => entry.quotas.find((quota) => quota.gradeCode === gradeCode)?.seatCount ?? 0)]),
      [1]
    );
  }

  private addGoalTemplatesSheet(workbook: ExcelJS.Workbook, bootstrap: AdminOrgBootstrap) {
    const departmentsById = new Map(bootstrap.departments.map((entry) => [entry.id, entry.name]));
    this.addSheet(
      workbook,
      SHEETS.goalTemplates,
      ['模板目标ID', '所属部门ID', '所属部门', '模板名称', '目标说明', '启用'],
      ['系统内部隐藏 ID', '隐藏辅助列', '必填，按名称匹配部门', '必填，同部门内不能重名', '可选', '填写 是/否'],
      '维护部门模板目标。模板关键结果请在“模板关键结果”sheet 里维护。',
      bootstrap.goalTemplates.map((entry) => [entry.id, entry.departmentId, departmentsById.get(entry.departmentId) ?? '', entry.name, entry.description ?? '', this.boolText(entry.isActive)]),
      [1, 2]
    );
  }

  private addGoalTemplateKeyResultsSheet(workbook: ExcelJS.Workbook, bootstrap: AdminOrgBootstrap) {
    this.addSheet(
      workbook,
      SHEETS.goalTemplateKeyResults,
      ['模板目标ID', '模板名称', '关键结果ID', '关键结果编号', '关键结果名称', '说明', '分值', '评分类型'],
      ['隐藏辅助列', '必填，按名称匹配模板目标', '系统内部隐藏 ID', '必填，如 KR1', '必填', '可选', '非负整数', '填写 客观评分项 或 主观评分项'],
      '维护模板目标下的关键结果。评分类型用于区分客观批量评分项和主观逐条评分项。',
      bootstrap.goalTemplates.flatMap((template) =>
        template.keyResults.map((entry) => [template.id, template.name, entry.id, entry.code, entry.name, entry.description ?? '', entry.points, this.scoreTypeLabel(entry.scoreType)])
      ),
      [1, 3]
    );
  }

  private addSheet(
    workbook: ExcelJS.Workbook,
    name: string,
    headers: string[],
    hints: string[],
    note: string,
    rows: Array<Array<string | number>>,
    hiddenColumns: number[] = []
  ) {
    const sheet = workbook.addWorksheet(name);
    const noteRow = sheet.addRow([note]);
    sheet.mergeCells(1, 1, 1, headers.length);
    noteRow.height = 26;
    const noteCell = noteRow.getCell(1);
    noteCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEAF3FF' }
    };
    noteCell.font = { bold: true, color: { argb: 'FF1F4E79' } };

    const hintRow = sheet.addRow(hints);
    hintRow.eachCell((cell) => {
      cell.font = { size: 11, color: { argb: 'FF6B7280' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
      };
    });

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
    sheet.views = [{ state: 'frozen', ySplit: 3 }];
    hiddenColumns.forEach((index) => {
      sheet.getColumn(index).hidden = true;
    });
  }

  private readRows(sheet: ExcelJS.Worksheet | undefined, visibleColumns: number[]) {
    if (!sheet || sheet.rowCount < 4) {
      return [] as ExcelJS.Row[];
    }

    return (
      sheet
        .getRows(4, sheet.rowCount - 3)
        ?.filter((row) => {
          return visibleColumns.some((index) => String(row.getCell(index).text ?? '').trim() !== '');
        }) ?? []
    );
  }

  private readString(row: ExcelJS.Row, index: number) {
    const value = row.getCell(index).text?.trim();
    return value ? value : '';
  }

  private requiredString(row: ExcelJS.Row, index: number, label: string) {
    const value = this.readString(row, index);
    if (!value) {
      throw new DomainValidationError(`${label}不能为空`);
    }
    return value;
  }

  private readBoolean(row: ExcelJS.Row, index: number, fallback: boolean) {
    const raw = this.readString(row, index);
    if (!raw) {
      return fallback;
    }
    const normalized = raw.toLowerCase();
    if (['1', 'true', 'yes', 'y', '是', '启用', '开启'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'n', '否', '停用', '关闭'].includes(normalized)) {
      return false;
    }
    return fallback;
  }

  private readInteger(row: ExcelJS.Row, index: number) {
    const value = Number(this.readString(row, index) || 0);
    if (!Number.isFinite(value) || value < 0) {
      return 0;
    }
    return Math.trunc(value);
  }

  private resolveReferenceId<T extends { id: string; name: string }>(params: {
    idValue: string;
    nameValue: string;
    items: T[];
    label: string;
  }) {
    return this.resolveReference({
      idValue: params.idValue,
      nameValue: params.nameValue,
      byId: new Map(params.items.map((entry) => [entry.id, entry])),
      byName: new Map(params.items.map((entry) => [entry.name.trim().toLowerCase(), entry])),
      label: params.label
    }).id;
  }

  private resolveOptionalReferenceId<T extends { id: string; name: string }>(params: {
    idValue: string;
    nameValue: string;
    items: T[];
    label: string;
  }) {
    if (!params.idValue && !params.nameValue) {
      return null;
    }

    return this.resolveReferenceId(params);
  }

  private resolveReference<T extends { id: string; name: string }>(params: {
    idValue: string;
    nameValue: string;
    byId: Map<string, T>;
    byName: Map<string, T>;
    label: string;
  }) {
    if (params.idValue && params.byId.has(params.idValue)) {
      return params.byId.get(params.idValue)!;
    }

    const normalizedName = params.nameValue.trim().toLowerCase();
    if (normalizedName && params.byName.has(normalizedName)) {
      return params.byName.get(normalizedName)!;
    }

    throw new DomainValidationError(`${params.label}匹配失败：${params.nameValue || params.idValue}`);
  }

  private parseRoleCode(value: string) {
    switch (value) {
      case 'system-admin':
      case '系统管理员':
        return 'system-admin';
      case 'section-leader':
      case '科室负责人':
        return 'section-leader';
      case 'group-leader':
      case '小组负责人':
        return 'group-leader';
      case 'employee':
      case '员工':
        return 'employee';
      default:
        throw new DomainValidationError(`未知角色：${value}`);
    }
  }

  private parseScoreType(value: string): ScoreTypeRecord {
    switch (value) {
      case 'objective':
      case '客观评分项':
        return 'objective';
      case 'subjective':
      case '主观评分项':
      case '':
        return 'subjective';
      default:
        throw new DomainValidationError(`未知评分类型：${value}`);
    }
  }

  private boolText(value: boolean) {
    return value ? '是' : '否';
  }

  private roleLabel(roleCode: string) {
    switch (roleCode) {
      case 'system-admin':
        return '系统管理员';
      case 'section-leader':
        return '科室负责人';
      case 'group-leader':
        return '小组负责人';
      case 'employee':
        return '员工';
      default:
        return roleCode;
    }
  }

  private scoreTypeLabel(value: ScoreTypeRecord) {
    return value === 'objective' ? '客观评分项' : '主观评分项';
  }

  private toTemplateRowValue(
    template: AdminOrgBootstrap['goalTemplates'][number],
    index: number
  ) {
    switch (index) {
      case 1:
        return template.id;
      case 2:
        return template.departmentId;
      case 3:
        return '';
      case 4:
        return template.name;
      case 5:
        return template.description ?? '';
      case 6:
        return this.boolText(template.isActive);
      default:
        return '';
    }
  }
}
