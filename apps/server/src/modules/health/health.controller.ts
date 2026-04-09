import { Controller, Get } from '@nestjs/common';
import { PrismaHealthService } from '../../infrastructure/database/prisma-health.service';
import { RuntimeConfigService } from '../config/runtime-config.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly runtimeConfig: RuntimeConfigService,
    private readonly prismaHealthService: PrismaHealthService
  ) {}

  @Get()
  async getHealth() {
    const database = await this.prismaHealthService.checkDatabase();

    return {
      ok: true,
      service: this.runtimeConfig.serviceName,
      authMode: this.runtimeConfig.authMode,
      database
    };
  }
}
