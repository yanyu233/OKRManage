import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';
import { REVIEW_GRADE_CODES } from '../../shared/constants/review-grade-codes';
import {
  type AdminGroupLeaderBindingRecord,
  type AdminLocalAccountInput,
  type AdminOrgBootstrapInput,
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

@Injectable()
export class AdminConfigService {
  constructor(
    @Inject(REVIEW_GROUPS_REPOSITORY) private readonly reviewGroupsRepository: ReviewGroupsRepository,
    @Inject(ORG_REPOSITORY) private readonly orgRepository: OrgRepository,
    private readonly auditService: AuditService
  ) {}

  async getBootstrap() {
    return this.orgRepository.getAdminBootstrap();
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
        ...assignment,
        id: assignment.id.trim(),
        userId: assignment.userId.trim(),
        roleCode: assignment.roleCode.trim(),
        scopeType: assignment.scopeType.trim(),
        scopeId: assignment.scopeId.trim()
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
          seatCount: Number(quota.seatCount)
        }))
      }))
    };
  }

  private validateBootstrap(input: AdminOrgBootstrapInput, actor: AuthUser) {
    this.ensureUnique(input.departments.map((entry) => entry.id), 'duplicate department id');
    this.ensureUnique(input.departments.map((entry) => entry.name.toLowerCase()), 'duplicate department name');
    this.ensureUnique(input.sections.map((entry) => entry.id), 'duplicate section id');
    this.ensureUnique(input.users.map((entry) => entry.id), 'duplicate user id');
    this.ensureUnique(input.reviewGroups.map((entry) => entry.id), 'duplicate review group id');
    this.ensureUnique(input.reviewGroups.map((entry) => entry.name.toLowerCase()), 'duplicate review group name');
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
