import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { LEADER_REPOSITORY, LeaderRepository } from '../../infrastructure/repositories/leader/leader.repository';
import { AuthUser } from '../../shared/types/auth-user';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';

@Injectable()
export class LeaderService {
  constructor(
    @Inject(LEADER_REPOSITORY) private readonly leaderRepository: LeaderRepository,
    private readonly auditService: AuditService
  ) {}

  getWorkbench(actor: AuthUser, year: number, quarter: number, employeeId?: string, goalId?: string) {
    this.validateQuarter(year, quarter);
    return this.leaderRepository.getWorkbench(actor, year, quarter, employeeId, goalId);
  }

  async updateKeyResultScore(actor: AuthUser, krId: string, score: number, comment?: string) {
    const result = await this.leaderRepository.updateKeyResultScore(actor, krId, score, comment?.trim() || null);
    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'leader.kr.score.update',
      entityType: 'key-result',
      entityId: krId,
      beforeJson: result.before,
      afterJson: {
        reviewScore: result.after.reviewScore,
        reviewComment: result.after.reviewComment
      }
    });
    return result.after;
  }

  getRanking(actor: AuthUser, year: number, quarter: number, reviewGroupId?: string, employeeId?: string) {
    this.validateQuarter(year, quarter);
    return this.leaderRepository.getRanking(actor, year, quarter, reviewGroupId, employeeId);
  }

  private validateQuarter(year: number, quarter: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new DomainValidationError('invalid year');
    }

    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      throw new DomainValidationError('invalid quarter');
    }
  }
}
