import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RuntimeConfigService {
  constructor(private readonly configService: ConfigService) {}

  get port(): number {
    return this.getRequiredPositiveInteger('PORT');
  }

  get authMode(): string {
    return this.getRequiredAllowedString('AUTH_MODE', ['local-debug']);
  }

  get sessionCookieName(): string {
    return this.getRequiredString('SESSION_COOKIE_NAME');
  }

  get sessionTtlMinutes(): number {
    return this.getRequiredPositiveInteger('SESSION_TTL_MINUTES');
  }

  get databaseUrl(): string {
    return this.getRequiredString('DATABASE_URL');
  }

  get debugSysadminLogin(): string {
    return this.getRequiredString('DEBUG_SYSADMIN_LOGIN');
  }

  get debugSysadminPassword(): string {
    return this.getRequiredString('DEBUG_SYSADMIN_PASSWORD');
  }

  get debugSysadminName(): string {
    return this.getRequiredString('DEBUG_SYSADMIN_NAME');
  }

  get serviceName(): string {
    return 'okr-node-foundation';
  }

  private getRequiredString(key: string): string {
    const value = this.configService.getOrThrow<string>(key);

    if (value.trim().length === 0) {
      throw new Error(`Invalid ${key}: value must not be empty`);
    }

    return value;
  }

  private getRequiredAllowedString(key: string, allowedValues: string[]): string {
    const value = this.getRequiredString(key);

    if (!allowedValues.includes(value)) {
      throw new Error(`Invalid ${key}: expected one of ${allowedValues.join(', ')}, got "${value}"`);
    }

    return value;
  }

  private getRequiredPositiveInteger(key: string): number {
    const rawValue = this.getRequiredString(key);
    const value = Number(rawValue);

    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Invalid ${key}: expected a positive integer, got "${rawValue}"`);
    }

    return value;
  }
}
