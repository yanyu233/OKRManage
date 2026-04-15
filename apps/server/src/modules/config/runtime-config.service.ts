import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';

export type AuthMode = 'local-debug' | 'wecom-preferred';

@Injectable()
export class RuntimeConfigService {
  constructor(private readonly configService: ConfigService) {}

  get port(): number {
    return this.getRequiredPositiveInteger('PORT');
  }

  get authMode(): AuthMode {
    return this.getRequiredAllowedString('AUTH_MODE', ['local-debug', 'wecom-preferred']) as AuthMode;
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

  get appBaseUrl(): string {
    return this.getRequiredString('APP_BASE_URL');
  }

  get webBaseUrl(): string {
    return this.getRequiredString('WEB_BASE_URL');
  }

  get kkFileViewPublicBaseUrl(): string {
    const configured = this.getOptionalString('KKFILEVIEW_PUBLIC_BASE_URL');
    if (configured) {
      return configured;
    }

    return new URL('/preview', this.webBaseUrl).toString();
  }

  get kkFileViewSourceBaseUrl(): string {
    const configured = this.getOptionalString('KKFILEVIEW_SOURCE_BASE_URL');
    if (configured) {
      return configured;
    }

    return `http://127.0.0.1:${this.port}`;
  }

  get kkFileViewPreviewToken(): string {
    const configured = this.getOptionalString('KKFILEVIEW_PREVIEW_TOKEN');
    if (configured) {
      return configured;
    }

    return 'okr-kkfileview-preview-token';
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

  get wecomCorpId(): string | null {
    return this.getOptionalString('WECOM_CORP_ID');
  }

  get wecomAgentId(): string | null {
    return this.getOptionalString('WECOM_AGENT_ID');
  }

  get wecomSecret(): string | null {
    return this.getOptionalString('WECOM_SECRET');
  }

  get wecomRedirectUri(): string | null {
    return this.getOptionalString('WECOM_REDIRECT_URI');
  }

  get isWecomConfigured(): boolean {
    return Boolean(this.wecomCorpId && this.wecomAgentId && this.wecomSecret && this.wecomRedirectUri);
  }

  get frontendOrigins(): string[] {
    const rawValue = this.configService.get<string>('FRONTEND_ORIGINS');
    if (!rawValue) {
      return ['http://127.0.0.1:5173', 'http://localhost:5173'];
    }

    return rawValue
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  get proofStorageDir(): string {
    const configured = this.configService.get<string>('PROOF_STORAGE_DIR');
    if (configured && configured.trim().length > 0) {
      return configured.trim();
    }

    return 'storage/proofs';
  }

  get libreOfficeExecutablePath(): string | null {
    const configured = this.getOptionalString('LIBREOFFICE_EXECUTABLE_PATH');
    if (configured) {
      return configured;
    }

    const commonCandidates =
      process.platform === 'win32'
        ? [
            'C:\\kkfvrun\\kkFileView-4.4.0\\LibreOfficePortable\\App\\libreoffice\\program\\soffice.com',
            'C:\\kkfvrun\\kkFileView-4.4.0\\LibreOfficePortable\\App\\libreoffice\\program\\soffice.exe',
            'C:\\Program Files\\LibreOffice\\program\\soffice.com',
            'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
            'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com',
            'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
          ]
        : ['/usr/bin/soffice', '/usr/local/bin/soffice'];

    const matched = commonCandidates.find((candidate) => existsSync(candidate));
    if (matched) {
      return matched;
    }

    return process.platform === 'win32' ? null : 'soffice';
  }

  get proofPdfPreviewTimeoutMs(): number {
    const configured = this.configService.get<string>('PROOF_PDF_PREVIEW_TIMEOUT_MS');
    if (!configured) {
      return 120_000;
    }

    const value = Number(configured);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Invalid PROOF_PDF_PREVIEW_TIMEOUT_MS: expected a positive integer, got "${configured}"`);
    }

    return value;
  }

  get serviceName(): string {
    return 'okr-node-foundation';
  }

  private getOptionalString(key: string): string | null {
    const value = this.configService.get<string>(key);
    if (!value || value.trim().length === 0) {
      return null;
    }

    return value.trim();
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
