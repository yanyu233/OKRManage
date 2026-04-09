import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RuntimeConfigService {
  constructor(private readonly configService: ConfigService) {}

  get port(): number {
    return Number(this.configService.get('PORT') ?? 3000);
  }

  get authMode(): string {
    return this.configService.get<string>('AUTH_MODE') ?? 'local-debug';
  }

  get sessionCookieName(): string {
    return this.configService.get<string>('SESSION_COOKIE_NAME') ?? 'okr_sid';
  }

  get sessionTtlMinutes(): number {
    return Number(this.configService.get('SESSION_TTL_MINUTES') ?? 480);
  }

  get serviceName(): string {
    return 'okr-node-foundation';
  }
}
