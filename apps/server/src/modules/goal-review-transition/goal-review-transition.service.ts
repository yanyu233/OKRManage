import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { shouldAdvanceGoalsToPendingReview } from '../../shared/time/goal-review-window';

const REVIEW_TRANSITION_INTERVAL_MS = 60_000;

@Injectable()
export class GoalReviewTransitionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(GoalReviewTransitionService.name);
  private intervalHandle: NodeJS.Timeout | null = null;
  private runningPromise: Promise<number> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.advanceEligibleGoalsToPendingReview();

    this.intervalHandle = setInterval(() => {
      void this.advanceEligibleGoalsToPendingReview();
    }, REVIEW_TRANSITION_INTERVAL_MS);
    this.intervalHandle.unref?.();
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  async advanceEligibleGoalsToPendingReview(date = new Date()): Promise<number> {
    if (this.runningPromise) {
      return this.runningPromise;
    }

    const task = this.runEligibleQuarterTransition(date).finally(() => {
      if (this.runningPromise === task) {
        this.runningPromise = null;
      }
    });

    this.runningPromise = task;
    return task;
  }

  async advanceQuarterGoalsToPendingReviewIfEligible(
    year: number,
    quarter: number,
    ownerUserId?: string | null,
    date = new Date()
  ): Promise<number> {
    if (!shouldAdvanceGoalsToPendingReview(year, quarter, date)) {
      return 0;
    }

    const result = await this.prisma.goal.updateMany({
      where: {
        year,
        quarter,
        status: {
          in: ['draft', 'confirmed']
        },
        ownerUserId: ownerUserId?.trim() || undefined
      },
      data: {
        status: 'pending-review'
      }
    });

    if (result.count > 0) {
      this.logger.log(
        `Advanced ${result.count} goal(s) to pending-review for ${year} Q${quarter}${ownerUserId ? ` (owner: ${ownerUserId})` : ''}`
      );
    }

    return result.count;
  }

  private async runEligibleQuarterTransition(date: Date): Promise<number> {
    const elapsedQuarterGoals = await this.prisma.goal.findMany({
      where: {
        status: {
          in: ['draft', 'confirmed']
        }
      },
      select: {
        year: true,
        quarter: true
      },
      distinct: ['year', 'quarter']
    });

    let affectedCount = 0;
    for (const goal of elapsedQuarterGoals) {
      affectedCount += await this.advanceQuarterGoalsToPendingReviewIfEligible(goal.year, goal.quarter, null, date);
    }

    return affectedCount;
  }
}
