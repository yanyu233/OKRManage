import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { SessionModule } from '../session/session.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [UsersModule, SessionModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService]
})
export class AuthModule {}
