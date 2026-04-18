import { Module } from '@nestjs/common';
import { GoalReviewTransitionService } from './goal-review-transition.service';

@Module({
  providers: [GoalReviewTransitionService],
  exports: [GoalReviewTransitionService]
})
export class GoalReviewTransitionModule {}
