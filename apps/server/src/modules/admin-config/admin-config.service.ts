import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';
import { REVIEW_GRADE_CODES } from '../../shared/constants/review-grade-codes';
import { ORG_REPOSITORY, OrgRepository } from '../../infrastructure/repositories/org/org.repository';
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
    return {
      reviewGroups: await this.reviewGroupsRepository.listAll()
    };
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
}
