import { Controller, Get } from '@nestjs/common';
import { RuntimeConfigService } from '../config/runtime-config.service';

@Controller('health')
export class HealthController {
  constructor(private readonly runtimeConfig: RuntimeConfigService) {}

  @Get()
  getHealth() {
    return {
      ok: true,
      service: this.runtimeConfig.serviceName,
      authMode: this.runtimeConfig.authMode
    };
  }
}
