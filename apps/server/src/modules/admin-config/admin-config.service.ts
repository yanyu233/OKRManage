import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GoalReviewTransitionService } from '../goal-review-transition/goal-review-transition.service';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';
import { REVIEW_GRADE_CODES } from '../../shared/constants/review-grade-codes';
import {
  type AdminGoalStatusTransitionInput,
  type AdminGroupLeaderBindingRecord,
  type AdminLocalAccountInput,
  type AdminOrgBootstrapInput,
  type AdminQuarterParticipationExclusionSaveInput,
  type AdminReviewGroupInput,
  type AdminRoleAssignmentRecord,
  type AdminSectionLeaderBindingRecord,
  ORG_REPOSITORY,
  OrgRepository
} from '../../infrastructure/repositories/org/org.repository';
import {
  REVIEW_GROUPS_REPOSITORY,
  ReviewGroupQuotaInput,
  ReviewGroupsRepository
} from '../../infrastructure/repositories/review-groups/review-groups.repository';
import { AuthUser } from '../../shared/types/auth-user';

type HistoricalPerformanceQuarterSource = 'okr' | 'manual' | 'none';

type HistoricalPerformanceQuarterRecord = {
  quarter: 1 | 2 | 3 | 4;
  systemScore: number | null;
  manualScore: number | null;
  effectiveScore: number;
  source: HistoricalPerformanceQuarterSource;
};

type HistoricalPerformanceEmployeeRecord = {
  employeeId: string;
  employeeNo: string | null;
  employeeName: string;
  positionName: string | null;
  sectionId: string | null;
  sectionName: string | null;
  reviewGroupId: string | null;
  reviewGroupName: string | null;
  annualScore: number;
  quarters: HistoricalPerformanceQuarterRecord[];
};

type HistoricalPerformanceSaveItem = {
  userId: string;
  quarter: number;
  score: number | null | undefined;
};

@Injectable()
export class AdminConfigService {
  constructor(
    @Inject(REVIEW_GROUPS_REPOSITORY) private readonly reviewGroupsRepository: ReviewGroupsRepository,
    @Inject(ORG_REPOSITORY) private readonly orgRepository: OrgRepository,
    private readonly prisma: PrismaService,
    private readonly goalReviewTransitionService: GoalReviewTransitionService,
    private readonly auditService: AuditService
  ) {}

  async getBootstrap() {
    return this.orgRepository.getAdminBootstrap();
  }

  async getHistoricalPerformance(year: number) {
    this.validateHistoricalPerformanceYear(year);

    const employees = await this.prisma.user.findMany({
      where: {
        isActive: true,
        roleAssignments: {
          some: {
            roleCode: 'employee',
            isEnabled: true
          }
        }
      },
      include: {
        section: true,
        reviewGroup: true,
        ownedGoals: {
          where: {
            year
          },
          include: {
            keyResults: {
              select: {
                reviewScore: true
              }
            }
          }
        },
        historicalScores: {
          where: {
            year
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    const records = employees
      .map<HistoricalPerformanceEmployeeRecord>((employee) => {
        const manualByQuarter = new Map(employee.historicalScores.map((item) => [item.quarter, item.score]));
        const quarters = ([1, 2, 3, 4] as const).map<HistoricalPerformanceQuarterRecord>((quarter) => {
          const quarterGoals = employee.ownedGoals.filter((goal) => goal.quarter === quarter);
          const hasSystemGoals = quarterGoals.length > 0;
          const systemScore = hasSystemGoals ? scoreFromGoalSummaries(quarterGoals) : null;
          const manualScore = normalizeOptionalScore(manualByQuarter.get(quarter));
          const effectiveScore = hasSystemGoals ? normalizeScore(systemScore ?? 0) : normalizeScore(manualScore ?? 0);

          return {
            quarter,
            systemScore,
            manualScore,
            effectiveScore,
            source: hasSystemGoals ? 'okr' : manualScore !== null ? 'manual' : 'none'
          };
        });

        return {
          employeeId: employee.id,
          employeeNo: employee.employeeNo,
          employeeName: employee.name,
          positionName: employee.positionName,
          sectionId: employee.sectionId,
          sectionName: employee.section?.name ?? null,
          reviewGroupId: employee.reviewGroupId,
          reviewGroupName: employee.reviewGroup?.name ?? null,
          annualScore: normalizeScore(quarters.reduce((sum, item) => sum + item.effectiveScore, 0)),
          quarters
        };
      })
      .sort(compareHistoricalPerformanceEmployees);

    return {
      year,
      records
    };
  }

  async getGoalStatusControls(year: number, quarter: number, userId?: string | null) {
    this.validateQuarter(year, quarter);

    return {
      year,
      quarter,
      records: await this.orgRepository.listGoalStatusControls({
        year,
        quarter,
        userId: userId?.trim() || null
      })
    };
  }

  async getQuarterParticipationExclusions(year: number, quarter: number) {
    this.validateQuarter(year, quarter);

    return {
      year,
      quarter,
      records: await this.orgRepository.listQuarterParticipationExclusions({
        year,
        quarter
      })
    };
  }

  async saveQuarterParticipationExclusions(
    input: AdminQuarterParticipationExclusionSaveInput,
    actor: AuthUser
  ) {
    this.validateQuarter(input.year, input.quarter);

    const userIds = Array.from(
      new Set(
        input.userIds
          .map((userId) => userId.trim())
          .filter((userId) => userId.length > 0)
      )
    );

    if (userIds.length > 0) {
      const employees = await this.prisma.user.findMany({
        where: {
          id: {
            in: userIds
          },
          isActive: true,
          roleAssignments: {
            some: {
              roleCode: 'employee',
              isEnabled: true
            }
          }
        },
        select: {
          id: true
        }
      });

      if (employees.length !== userIds.length) {
        throw new DomainValidationError('quarter participation exclusion target employee is invalid');
      }
    }

    await this.orgRepository.saveQuarterParticipationExclusions({
      year: input.year,
      quarter: input.quarter,
      userIds
    });

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'admin.quarter-participation-exclusions.save',
      entityType: 'quarter-participation-exclusion',
      entityId: `${input.year}-Q${input.quarter}`,
      afterJson: {
        year: input.year,
        quarter: input.quarter,
        userIds
      }
    });

    return this.getQuarterParticipationExclusions(input.year, input.quarter);
  }

  async transitionGoalStatuses(input: AdminGoalStatusTransitionInput, actor: AuthUser) {
    this.validateQuarter(input.year, input.quarter);

    const normalized = {
      year: input.year,
      quarter: input.quarter,
      userId: input.userId?.trim() || null,
      targetStatus: input.targetStatus
    };
    const affectedGoalCount = await this.orgRepository.transitionGoalStatuses(normalized);
    const autoAdvancedGoalCount =
      normalized.targetStatus === 'confirmed'
        ? await this.goalReviewTransitionService.advanceQuarterGoalsToPendingReviewIfEligible(
            normalized.year,
            normalized.quarter,
            normalized.userId
          )
        : 0;

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'admin.goal-status.transition',
      entityType: 'goal',
      entityId: normalized.userId ?? null,
      afterJson: normalized
    });

    return { affectedGoalCount, autoAdvancedGoalCount };
  }

  async saveHistoricalPerformance(year: number, items: HistoricalPerformanceSaveItem[], actor: AuthUser) {
    this.validateHistoricalPerformanceYear(year);

    const normalizedItems = dedupeHistoricalPerformanceItems(items).map((item) => {
      if (!item.userId.trim()) {
        throw new DomainValidationError('historical performance user is required');
      }

      if (!Number.isInteger(item.quarter) || item.quarter < 1 || item.quarter > 4) {
        throw new DomainValidationError('historical performance quarter is invalid');
      }

      if (item.score === null || item.score === undefined) {
        return {
          userId: item.userId.trim(),
          quarter: item.quarter,
          score: null
        };
      }

      if (!Number.isFinite(item.score) || item.score < 0 || item.score > 100) {
        throw new DomainValidationError('historical performance score must be between 0 and 100');
      }

      return {
        userId: item.userId.trim(),
        quarter: item.quarter,
        score: normalizeScore(item.score)
      };
    });

    const employeeIds = Array.from(new Set(normalizedItems.map((item) => item.userId)));
    const employees = await this.prisma.user.findMany({
      where: {
        id: {
          in: employeeIds
        },
        isActive: true,
        roleAssignments: {
          some: {
            roleCode: 'employee',
            isEnabled: true
          }
        }
      },
      select: {
        id: true
      }
    });
    const validEmployeeIds = new Set(employees.map((employee) => employee.id));

    for (const item of normalizedItems) {
      if (!validEmployeeIds.has(item.userId)) {
        throw new DomainValidationError('historical performance target employee is invalid');
      }
    }

    await this.prisma.$transaction(async (transaction) => {
      for (const item of normalizedItems) {
        if (item.score === null) {
          await transaction.historicalPerformanceScore.deleteMany({
            where: {
              userId: item.userId,
              year,
              quarter: item.quarter
            }
          });
          continue;
        }

        await transaction.historicalPerformanceScore.upsert({
          where: {
            userId_year_quarter: {
              userId: item.userId,
              year,
              quarter: item.quarter
            }
          },
          update: {
            score: item.score
          },
          create: {
            userId: item.userId,
            year,
            quarter: item.quarter,
            score: item.score
          }
        });
      }
    });

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'admin.historical-performance.save',
      entityType: 'historical-performance',
      entityId: String(year),
      afterJson: {
        year,
        itemCount: normalizedItems.length
      }
    });

    return this.getHistoricalPerformance(year);
  }

  async saveBootstrap(input: AdminOrgBootstrapInput, actor: AuthUser) {
    const normalized = this.normalizeBootstrap(input);
    this.validateBootstrap(normalized, actor);
    await this.orgRepository.saveAdminBootstrap(normalized);
    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'admin.org.bootstrap.save',
      entityType: 'org-bootstrap',
      entityId: actor.id,
      afterJson: {
        departments: normalized.departments.length,
        sections: normalized.sections.length,
        users: normalized.users.length,
        reviewGroups: normalized.reviewGroups.length
      }
    });
    return this.orgRepository.getAdminBootstrap();
  }

  async createReviewGroup(name: string, actor: AuthUser) {
    const reviewGroup = await this.reviewGroupsRepository.create(name.trim());
    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'admin.review-group.create',
      entityType: 'review-group',
      entityId: reviewGroup.id,
      afterJson: reviewGroup
    });
    return reviewGroup;
  }

  async updateReviewGroup(id: string, name: string, actor: AuthUser) {
    const reviewGroup = await this.reviewGroupsRepository.update(id, name.trim());
    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'admin.review-group.update',
      entityType: 'review-group',
      entityId: reviewGroup.id,
      afterJson: reviewGroup
    });
    return reviewGroup;
  }

  async saveReviewGroupQuotas(id: string, quotas: ReviewGroupQuotaInput[], actor: AuthUser) {
    this.validateQuotas(quotas);

    const memberCount = await this.orgRepository.countActiveUsersByReviewGroupId(id);
    const totalSeatCount = quotas.reduce((sum, quota) => sum + quota.seatCount, 0);

    if (totalSeatCount > memberCount) {
      throw new DomainValidationError('quota total exceeds active member count');
    }

    await this.reviewGroupsRepository.saveQuotas(id, quotas);
    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'admin.review-group.quotas.update',
      entityType: 'review-group',
      entityId: id,
      afterJson: {
        quotas
      }
    });
  }

  async deleteReviewGroup(id: string, actor: AuthUser) {
    const memberCount = await this.orgRepository.countActiveUsersByReviewGroupId(id);
    if (memberCount > 0) {
      throw new DomainValidationError('cannot delete review group with active members');
    }

    await this.reviewGroupsRepository.delete(id);
    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'admin.review-group.delete',
      entityType: 'review-group',
      entityId: id
    });
  }

  private validateHistoricalPerformanceYear(year: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new DomainValidationError('historical performance year is invalid');
    }
  }

  private validateQuarter(year: number, quarter: number) {
    this.validateHistoricalPerformanceYear(year);

    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      throw new DomainValidationError('quarter is invalid');
    }
  }

  private validateQuotas(quotas: ReviewGroupQuotaInput[]) {
    const seen = new Set<string>();

    for (const quota of quotas) {
      if (!REVIEW_GRADE_CODES.includes(quota.gradeCode)) {
        throw new DomainValidationError(`unsupported grade code: ${quota.gradeCode}`);
      }

      if (seen.has(quota.gradeCode)) {
        throw new DomainValidationError(`duplicate grade code: ${quota.gradeCode}`);
      }

      seen.add(quota.gradeCode);
    }

    if (seen.size !== REVIEW_GRADE_CODES.length) {
      throw new DomainValidationError('all grade codes must be provided');
    }
  }

  private normalizeBootstrap(input: AdminOrgBootstrapInput): AdminOrgBootstrapInput {
    return {
      departments: input.departments.map((department) => ({
        ...department,
        id: department.id.trim(),
        name: department.name.trim()
      })),
      sections: input.sections.map((section) => ({
        ...section,
        id: section.id.trim(),
        departmentId: section.departmentId.trim(),
        name: section.name.trim()
      })),
      users: input.users.map((user) => ({
        ...user,
        id: user.id.trim(),
        employeeNo: user.employeeNo?.trim() || null,
        name: user.name.trim(),
        positionName: user.positionName?.trim() || null,
        departmentId: user.departmentId?.trim() || null,
        sectionId: user.sectionId?.trim() || null,
        reviewGroupId: user.reviewGroupId?.trim() || null
      })),
      localAccounts: input.localAccounts.map((account) => ({
        ...account,
        userId: account.userId.trim(),
        loginName: account.loginName.trim().toLowerCase(),
        password: account.password?.trim() || null
      })),
      roleAssignments: input.roleAssignments.map((assignment) => ({
        ...this.normalizeRoleAssignment(assignment),
        isPrimary: assignment.isPrimary,
        isEnabled: assignment.isEnabled
      })),
      sectionLeaderBindings: input.sectionLeaderBindings.map((binding) => ({
        ...binding,
        id: binding.id.trim(),
        leaderUserId: binding.leaderUserId.trim(),
        sectionId: binding.sectionId.trim()
      })),
      groupLeaderBindings: input.groupLeaderBindings.map((binding) => ({
        ...binding,
        id: binding.id.trim(),
        leaderUserId: binding.leaderUserId.trim(),
        reviewGroupId: binding.reviewGroupId.trim()
      })),
      reviewGroups: input.reviewGroups.map((reviewGroup) => ({
        ...reviewGroup,
        id: reviewGroup.id.trim(),
        name: reviewGroup.name.trim(),
        quotas: reviewGroup.quotas.map((quota) => ({
          gradeCode: quota.gradeCode,
          seatCount: this.normalizeNonNegativeInteger(quota.seatCount)
        }))
      })),
      goalTemplates: input.goalTemplates.map((template) => ({
        ...template,
        id: template.id.trim(),
        departmentId: template.departmentId.trim(),
        name: template.name.trim(),
        description: template.description?.trim() || null,
        keyResults: template.keyResults.map((keyResult) => ({
          ...keyResult,
          id: keyResult.id.trim(),
          code: keyResult.code.trim(),
          name: keyResult.name.trim(),
          description: keyResult.description?.trim() || null,
          points: this.normalizeNonNegativeInteger(keyResult.points)
        }))
      }))
    };
  }

  private normalizeRoleAssignment(assignment: AdminRoleAssignmentRecord): AdminRoleAssignmentRecord {
    const id = assignment.id.trim();
    const userId = assignment.userId.trim();
    const roleCode = assignment.roleCode.trim();
    const scope = this.deriveRoleScope(roleCode, userId);

    return {
      ...assignment,
      id,
      userId,
      roleCode,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId
    };
  }

  private deriveRoleScope(roleCode: string, userId: string) {
    switch (roleCode) {
      case 'system-admin':
        return { scopeType: 'system', scopeId: 'system' };
      case 'department-head':
        return { scopeType: 'department', scopeId: `managed-department:${userId || 'pending'}` };
      case 'employee':
        return { scopeType: 'user', scopeId: userId || 'user:pending' };
      case 'section-leader':
        return { scopeType: 'section', scopeId: `managed-section:${userId || 'pending'}` };
      case 'group-leader':
        return { scopeType: 'review-group', scopeId: `managed-group:${userId || 'pending'}` };
      default:
        return { scopeType: 'user', scopeId: userId || 'user:pending' };
    }
  }

  private normalizeNonNegativeInteger(value: unknown) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return 0;
    }

    return Math.trunc(numeric);
  }

  private validateBootstrap(input: AdminOrgBootstrapInput, actor: AuthUser) {
    this.ensureUnique(input.departments.map((entry) => entry.id), 'duplicate department id');
    this.ensureUnique(input.departments.map((entry) => entry.name.toLowerCase()), 'duplicate department name');
    this.ensureUnique(input.sections.map((entry) => entry.id), 'duplicate section id');
    this.ensureUnique(input.users.map((entry) => entry.id), 'duplicate user id');
    this.ensureUnique(input.reviewGroups.map((entry) => entry.id), 'duplicate review group id');
    this.ensureUnique(input.reviewGroups.map((entry) => entry.name.toLowerCase()), 'duplicate review group name');
    this.ensureUnique(input.goalTemplates.map((entry) => entry.id), 'duplicate goal template id');
    this.ensureUnique(
      input.goalTemplates.map((entry) => `${entry.departmentId}|${entry.name.toLowerCase()}`),
      'duplicate goal template name in department'
    );
    this.ensureUnique(input.localAccounts.map((entry) => entry.userId), 'duplicate local account user');
    this.ensureUnique(input.localAccounts.map((entry) => entry.loginName), 'duplicate local account login');
    this.ensureUnique(input.roleAssignments.map((entry) => entry.id), 'duplicate role assignment id');
    this.ensureUnique(
      input.roleAssignments.map((entry) => `${entry.userId}|${entry.roleCode}|${entry.scopeType}|${entry.scopeId}`),
      'duplicate role assignment scope'
    );
    this.ensureUnique(input.sectionLeaderBindings.map((entry) => entry.id), 'duplicate section leader binding id');
    this.ensureUnique(input.groupLeaderBindings.map((entry) => entry.id), 'duplicate group leader binding id');

    const departmentIds = new Set(input.departments.map((entry) => entry.id));
    const sectionById = new Map(input.sections.map((entry) => [entry.id, entry]));
    const reviewGroupIds = new Set(input.reviewGroups.map((entry) => entry.id));
    const userIds = new Set(input.users.map((entry) => entry.id));

    for (const department of input.departments) {
      if (!department.id || !department.name) {
        throw new DomainValidationError('department id and name are required');
      }
    }

    for (const template of input.goalTemplates) {
      if (!template.id || !template.name) {
        throw new DomainValidationError('goal template id and name are required');
      }

      if (!departmentIds.has(template.departmentId)) {
        throw new DomainValidationError(`goal template ${template.name} references unknown department`);
      }

      if (template.keyResults.length === 0) {
        throw new DomainValidationError(`goal template ${template.name} requires at least one key result`);
      }

      this.ensureUnique(
        template.keyResults.map((entry) => entry.id),
        `duplicate goal template key result id in ${template.name}`
      );
      this.ensureUnique(
        template.keyResults.map((entry) => entry.code.toLowerCase()),
        `duplicate goal template key result code in ${template.name}`
      );

      for (const keyResult of template.keyResults) {
        if (!keyResult.code || !keyResult.name) {
          throw new DomainValidationError(`goal template ${template.name} has incomplete key result data`);
        }

        if (!Number.isInteger(keyResult.points) || keyResult.points < 0) {
          throw new DomainValidationError(`goal template ${template.name} has invalid key result points`);
        }
      }
    }

    for (const section of input.sections) {
      if (!departmentIds.has(section.departmentId)) {
        throw new DomainValidationError(`section ${section.name} references unknown department`);
      }
    }

    for (const user of input.users) {
      if (!user.id || !user.name) {
        throw new DomainValidationError('user id and name are required');
      }

      if (user.departmentId && !departmentIds.has(user.departmentId)) {
        throw new DomainValidationError(`user ${user.name} references unknown department`);
      }

      if (user.sectionId) {
        const section = sectionById.get(user.sectionId);
        if (!section) {
          throw new DomainValidationError(`user ${user.name} references unknown section`);
        }
        if (user.departmentId && section.departmentId !== user.departmentId) {
          throw new DomainValidationError(`user ${user.name} section does not belong to department`);
        }
      }

      if (user.reviewGroupId && !reviewGroupIds.has(user.reviewGroupId)) {
        throw new DomainValidationError(`user ${user.name} references unknown review group`);
      }
    }

    for (const account of input.localAccounts) {
      if (!userIds.has(account.userId)) {
        throw new DomainValidationError(`local account ${account.loginName} references unknown user`);
      }
      if (!account.loginName) {
        throw new DomainValidationError('local account login name is required');
      }
      if (account.localLoginEnabled && !account.password && !input.users.find((entry) => entry.id === account.userId)) {
        throw new DomainValidationError(`local account ${account.loginName} requires a password`);
      }
    }

    for (const assignment of input.roleAssignments) {
      if (!userIds.has(assignment.userId)) {
        throw new DomainValidationError(`role assignment ${assignment.id} references unknown user`);
      }
    }

    this.validateLeaderBindings(input.sectionLeaderBindings, input.groupLeaderBindings, userIds, sectionById, reviewGroupIds);
    this.validateReviewGroupPayload(input.reviewGroups, input.users);
    this.validateActorRetention(input.roleAssignments, input.users, actor);
  }

  private validateLeaderBindings(
    sectionLeaderBindings: AdminSectionLeaderBindingRecord[],
    groupLeaderBindings: AdminGroupLeaderBindingRecord[],
    userIds: Set<string>,
    sectionById: Map<string, { departmentId: string }>,
    reviewGroupIds: Set<string>
  ) {
    for (const binding of sectionLeaderBindings) {
      if (!userIds.has(binding.leaderUserId)) {
        throw new DomainValidationError(`section leader binding ${binding.id} references unknown user`);
      }
      if (!sectionById.has(binding.sectionId)) {
        throw new DomainValidationError(`section leader binding ${binding.id} references unknown section`);
      }
    }

    for (const binding of groupLeaderBindings) {
      if (!userIds.has(binding.leaderUserId)) {
        throw new DomainValidationError(`group leader binding ${binding.id} references unknown user`);
      }
      if (!reviewGroupIds.has(binding.reviewGroupId)) {
        throw new DomainValidationError(`group leader binding ${binding.id} references unknown review group`);
      }
    }
  }

  private validateReviewGroupPayload(reviewGroups: AdminReviewGroupInput[], users: AdminOrgBootstrapInput['users']) {
    const activeUserCounts = new Map<string, number>();

    for (const user of users) {
      if (!user.isActive || !user.reviewGroupId) {
        continue;
      }

      activeUserCounts.set(user.reviewGroupId, (activeUserCounts.get(user.reviewGroupId) ?? 0) + 1);
    }

    for (const reviewGroup of reviewGroups) {
      this.validateQuotas(reviewGroup.quotas);

      for (const quota of reviewGroup.quotas) {
        if (!Number.isInteger(quota.seatCount) || quota.seatCount < 0) {
          throw new DomainValidationError(`invalid seat count for ${reviewGroup.name} / ${quota.gradeCode}`);
        }
      }

      const totalSeats = reviewGroup.quotas.reduce((sum, quota) => sum + quota.seatCount, 0);
      const memberCount = activeUserCounts.get(reviewGroup.id) ?? 0;

      if (totalSeats > memberCount) {
        throw new DomainValidationError(`quota total exceeds active member count for ${reviewGroup.name}`);
      }
    }
  }

  private validateActorRetention(
    roleAssignments: AdminRoleAssignmentRecord[],
    users: AdminOrgBootstrapInput['users'],
    actor: AuthUser
  ) {
    const actorUser = users.find((entry) => entry.id === actor.id);
    if (!actorUser || !actorUser.isActive) {
      throw new DomainValidationError('current system admin must remain active');
    }

    const keepsSystemAdmin = roleAssignments.some(
      (entry) => entry.userId === actor.id && entry.roleCode === 'system-admin' && entry.isEnabled
    );
    if (!keepsSystemAdmin) {
      throw new DomainValidationError('current system admin must keep system-admin access');
    }
  }

  private ensureUnique(values: string[], message: string) {
    const normalized = values.filter((value) => value && value.trim().length > 0);
    if (new Set(normalized).size !== normalized.length) {
      throw new DomainValidationError(message);
    }
  }
}

function dedupeHistoricalPerformanceItems(items: HistoricalPerformanceSaveItem[]) {
  return Array.from(
    new Map(
      items.map((item) => [`${item.userId.trim()}|${item.quarter}`, item])
    ).values()
  );
}

function scoreFromGoalSummaries(
  goals: Array<{
    keyResults: Array<{
      reviewScore: number | null;
    }>;
  }>
) {
  return normalizeScore(
    goals.reduce(
      (sum, goal) => sum + goal.keyResults.reduce((goalSum, keyResult) => goalSum + (keyResult.reviewScore ?? 0), 0),
      0
    )
  );
}

function normalizeScore(value: number) {
  return Number(value.toFixed(1));
}

function normalizeOptionalScore(value: number | null | undefined) {
  return value === null || value === undefined ? null : normalizeScore(value);
}

function compareHistoricalPerformanceEmployees(
  left: HistoricalPerformanceEmployeeRecord,
  right: HistoricalPerformanceEmployeeRecord
) {
  const sectionCompare = (left.sectionName ?? '').localeCompare(right.sectionName ?? '', 'zh-CN');
  if (sectionCompare !== 0) {
    return sectionCompare;
  }

  const groupCompare = (left.reviewGroupName ?? '').localeCompare(right.reviewGroupName ?? '', 'zh-CN');
  if (groupCompare !== 0) {
    return groupCompare;
  }

  return left.employeeName.localeCompare(right.employeeName, 'zh-CN');
}
