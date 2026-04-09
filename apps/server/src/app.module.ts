import { Module } from '@nestjs/common';
import { RuntimeConfigModule } from './modules/config/runtime-config.module';
import { HealthModule } from './modules/health/health.module';
import { SessionModule } from './modules/session/session.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './infrastructure/database/prisma.module';

@Module({
  imports: [RuntimeConfigModule, PrismaModule, SessionModule, UsersModule, AuthModule, HealthModule]
})
export class AppModule {}
