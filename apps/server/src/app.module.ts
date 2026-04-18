import { Module } from '@nestjs/common';
import { RuntimeConfigModule } from './modules/config/runtime-config.module';
import { HealthModule } from './modules/health/health.module';
import { SessionModule } from './modules/session/session.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { AdminConfigModule } from './modules/admin-config/admin-config.module';
import { LeaderModule } from './modules/leader/leader.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { GoalReviewTransitionModule } from './modules/goal-review-transition/goal-review-transition.module';

@Module({
  imports: [
    RuntimeConfigModule,
    PrismaModule,
    SessionModule,
    UsersModule,
    AuthModule,
    HealthModule,
    GoalReviewTransitionModule,
    AdminConfigModule,
    LeaderModule,
    EmployeeModule
  ]
})
export class AppModule {}
