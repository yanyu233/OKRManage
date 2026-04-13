import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SessionModule } from '../session/session.module';
import { AdminConfigController } from './admin-config.controller';
import { AdminConfigService } from './admin-config.service';
import { AdminConfigExcelService } from './admin-config-excel.service';
import { ORG_REPOSITORY } from '../../infrastructure/repositories/org/org.repository';
import { PrismaOrgRepository } from '../../infrastructure/repositories/org/prisma-org.repository';
import {
  REVIEW_GROUPS_REPOSITORY
} from '../../infrastructure/repositories/review-groups/review-groups.repository';
import { PrismaReviewGroupsRepository } from '../../infrastructure/repositories/review-groups/prisma-review-groups.repository';

@Module({
  imports: [SessionModule, AuditModule],
  controllers: [AdminConfigController],
  providers: [
    AdminConfigService,
    AdminConfigExcelService,
    PrismaOrgRepository,
    PrismaReviewGroupsRepository,
    {
      provide: ORG_REPOSITORY,
      useExisting: PrismaOrgRepository
    },
    {
      provide: REVIEW_GROUPS_REPOSITORY,
      useExisting: PrismaReviewGroupsRepository
    }
  ]
})
export class AdminConfigModule {}
