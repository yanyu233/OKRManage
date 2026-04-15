import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { RuntimeConfigService } from '../config/runtime-config.service';

const execFileAsync = promisify(execFile);
const WINDOWS_WORD_PATHS = [
  'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
  'C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\WINWORD.EXE'
];
const WINDOWS_POWERPOINT_PATHS = [
  'C:\\Program Files\\Microsoft Office\\root\\Office16\\POWERPNT.EXE',
  'C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\POWERPNT.EXE'
];

@Injectable()
export class PreviewHealthService {
  constructor(private readonly runtimeConfig: RuntimeConfigService) {}

  async getStatus() {
    const libreOffice = await this.inspectLibreOffice();
    const windowsOffice = this.inspectWindowsOffice();
    const preferredEngine = process.platform === 'win32' ? 'windows-office-com' : 'libreoffice';
    const officeToPdfAvailable =
      preferredEngine === 'windows-office-com'
        ? windowsOffice.available || libreOffice.available
        : libreOffice.available;

    return {
      platform: process.platform,
      preferredEngine,
      officeToPdfAvailable,
      windowsOffice,
      libreOffice
    };
  }

  private inspectWindowsOffice() {
    const wordPath = WINDOWS_WORD_PATHS.find((candidate) => existsSync(candidate)) ?? null;
    const powerPointPath = WINDOWS_POWERPOINT_PATHS.find((candidate) => existsSync(candidate)) ?? null;

    return {
      available: Boolean(wordPath && powerPointPath),
      wordPath,
      powerPointPath
    };
  }

  private async inspectLibreOffice() {
    const executablePath = this.runtimeConfig.libreOfficeExecutablePath;
    if (!executablePath) {
      return {
        available: false,
        executablePath: null,
        version: null,
        error: 'not configured'
      };
    }

    try {
      const { stdout, stderr } = await execFileAsync(executablePath, ['--version'], {
        timeout: 5_000,
        windowsHide: true,
        maxBuffer: 1024 * 1024
      });

      return {
        available: true,
        executablePath,
        version: stdout.trim() || stderr.trim() || null,
        error: null
      };
    } catch (error) {
      return {
        available: false,
        executablePath,
        version: null,
        error: error instanceof Error ? error.message : 'unknown error'
      };
    }
  }
}
