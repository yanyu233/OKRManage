import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PreviewHealthService } from './preview-health.service';

@Module({
  controllers: [HealthController],
  providers: [PreviewHealthService]
})
export class HealthModule {}
