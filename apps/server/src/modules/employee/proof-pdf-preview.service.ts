import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { EMPLOYEE_REPOSITORY, EmployeeRepository } from '../../infrastructure/repositories/employee/employee.repository';
import { ProofArchiveService } from '../../infrastructure/storage/proof-archive.service';
import { LocalProofStorageService } from '../../infrastructure/storage/local-proof-storage.service';
import { buildSafeProofPreviewFileName } from '../../shared/proof/proof-links';
import { RuntimeConfigService } from '../config/runtime-config.service';

const execFileAsync = promisify(execFile);
const WORD_AUTOMATION_EXTENSIONS = new Set(['.doc', '.docx', '.docm', '.rtf']);
const POWERPOINT_AUTOMATION_EXTENSIONS = new Set(['.ppt', '.pptx', '.pptm']);

type PdfPreviewResult = {
  fileName: string;
  pdfPath: string;
};

@Injectable()
export class ProofPdfPreviewService {
  private readonly logger = new Logger(ProofPdfPreviewService.name);
  private readonly inFlight = new Map<string, Promise<PdfPreviewResult | null>>();

  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepository: EmployeeRepository,
    private readonly proofStorage: LocalProofStorageService,
    private readonly proofArchive: ProofArchiveService,
    private readonly runtimeConfig: RuntimeConfigService
  ) {}

  async ensurePdfPreview(proofId: string, entryPath?: string | null) {
    const normalizedEntryPath = entryPath?.trim() ? normalizeArchiveEntryPath(entryPath) : null;
    const cacheKey = normalizedEntryPath ? `${proofId}:${normalizedEntryPath}` : proofId;
    const existing = this.inFlight.get(cacheKey);
    if (existing) {
      return existing;
    }

    const conversion = this.convertToPdf(proofId, normalizedEntryPath).finally(() => {
      this.inFlight.delete(cacheKey);
    });

    this.inFlight.set(cacheKey, conversion);
    return conversion;
  }

  async openPdfPreview(proofId: string, entryPath?: string | null) {
    const converted = await this.ensurePdfPreview(proofId, entryPath);
    if (!converted) {
      return null;
    }

    return {
      fileName: converted.fileName,
      file: createReadStream(converted.pdfPath)
    };
  }

  private async convertToPdf(proofId: string, entryPath?: string | null): Promise<PdfPreviewResult | null> {
    const libreOfficePath = normalizeLibreOfficeCliPath(this.runtimeConfig.libreOfficeExecutablePath);
    const proof = await this.employeeRepository.getProofStorage(proofId);
    const normalizedEntryPath = entryPath?.trim() ? normalizeArchiveEntryPath(entryPath) : null;
    const sourceFileName = normalizedEntryPath ? basename(normalizedEntryPath) : proof.fileName;
    const extension = extname(sourceFileName).toLowerCase();
    const cacheKey = normalizedEntryPath
      ? `${proofId}:${proof.storageKey}:${normalizedEntryPath}`
      : `${proofId}:${proof.storageKey}`;
    const cacheDir = resolve(
      join(this.proofStorage.storageRoot, '.pdf-preview-cache', createHash('sha1').update(cacheKey).digest('hex').slice(0, 16))
    );
    const safeSourceName = buildSafeProofPreviewFileName(sourceFileName, cacheKey);
    const sourceCopyPath = join(cacheDir, safeSourceName);
    const pdfPath = join(cacheDir, replaceExtension(safeSourceName, '.pdf'));
    const downloadName = replaceExtension(sourceFileName, '.pdf');
    const profileDir = join(cacheDir, '.lo-profile');

    if (await fileExists(pdfPath)) {
      return {
        fileName: downloadName,
        pdfPath
      };
    }

    const originalPath = normalizedEntryPath
      ? await this.proofArchive.getEntryAbsolutePath(proof.storageKey, normalizedEntryPath)
      : await this.proofStorage.getAbsolutePath(proof.storageKey);

    await mkdir(cacheDir, { recursive: true });
    await mkdir(profileDir, { recursive: true });
    await copyFile(originalPath, sourceCopyPath);

    const preferWindowsOffice = isWindowsOfficePreferredExtension(extension);
    if (preferWindowsOffice) {
      const officeConverted = await this.convertWithWindowsOfficeAutomation(cacheKey, extension, sourceCopyPath, pdfPath);
      if (officeConverted) {
        return {
          fileName: downloadName,
          pdfPath
        };
      }
    }

    if (libreOfficePath) {
      const libreOfficeConverted = await this.convertWithLibreOffice(
        cacheKey,
        libreOfficePath,
        profileDir,
        cacheDir,
        sourceCopyPath,
        pdfPath
      );
      if (libreOfficeConverted) {
        return {
          fileName: downloadName,
          pdfPath
        };
      }
    }

    if (!preferWindowsOffice) {
      const officeConverted = await this.convertWithWindowsOfficeAutomation(cacheKey, extension, sourceCopyPath, pdfPath);
      if (officeConverted) {
        return {
          fileName: downloadName,
          pdfPath
        };
      }
    }

    return null;
  }

  private async convertWithLibreOffice(
    cacheKey: string,
    executablePath: string,
    profileDir: string,
    cacheDir: string,
    sourceCopyPath: string,
    pdfPath: string
  ) {
    try {
      const { stdout, stderr } = await execFileAsync(
        executablePath,
        [
          `-env:UserInstallation=${pathToFileURL(profileDir).toString()}`,
          '--headless',
          '--nologo',
          '--nodefault',
          '--nolockcheck',
          '--norestore',
          '--convert-to',
          'pdf',
          '--outdir',
          cacheDir,
          sourceCopyPath
        ],
        {
          timeout: this.runtimeConfig.proofPdfPreviewTimeoutMs,
          windowsHide: true,
          maxBuffer: 10 * 1024 * 1024
        }
      );

      if (stdout?.trim()) {
        this.logger.debug(`LibreOffice PDF fallback stdout for ${cacheKey}: ${stdout.trim()}`);
      }

      if (stderr?.trim()) {
        this.logger.warn(`LibreOffice PDF fallback stderr for ${cacheKey}: ${stderr.trim()}`);
      }
    } catch (error) {
      const details =
        typeof error === 'object' && error && 'stderr' in error && typeof error.stderr === 'string'
          ? ` stderr=${error.stderr.trim()}`
          : '';
      this.logger.warn(
        `LibreOffice PDF fallback failed for ${cacheKey}: ${error instanceof Error ? error.message : 'unknown error'}${details}`
      );
      return false;
    }

    if (!(await fileExists(pdfPath))) {
      this.logger.warn(`LibreOffice PDF fallback did not produce output for ${cacheKey}`);
      return false;
    }

    return true;
  }

  private async convertWithWindowsOfficeAutomation(
    cacheKey: string,
    extension: string,
    sourceCopyPath: string,
    pdfPath: string
  ) {
    if (process.platform !== 'win32') {
      return false;
    }

    const script = buildWindowsOfficePdfScript(extension, sourceCopyPath, pdfPath);
    if (!script) {
      return false;
    }

    try {
      const { stdout, stderr } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encodePowerShellCommand(script)],
        {
          timeout: this.runtimeConfig.proofPdfPreviewTimeoutMs,
          windowsHide: true,
          maxBuffer: 10 * 1024 * 1024
        }
      );

      if (stdout?.trim()) {
        this.logger.debug(`Windows Office PDF fallback stdout for ${cacheKey}: ${stdout.trim()}`);
      }

      if (stderr?.trim()) {
        this.logger.warn(`Windows Office PDF fallback stderr for ${cacheKey}: ${stderr.trim()}`);
      }
    } catch (error) {
      const details =
        typeof error === 'object' && error && 'stderr' in error && typeof error.stderr === 'string'
          ? ` stderr=${error.stderr.trim()}`
          : '';
      this.logger.warn(
        `Windows Office PDF fallback failed for ${cacheKey}: ${error instanceof Error ? error.message : 'unknown error'}${details}`
      );
      return false;
    }

    if (!(await fileExists(pdfPath))) {
      this.logger.warn(`Windows Office PDF fallback did not produce output for ${cacheKey}`);
      return false;
    }

    return true;
  }
}

function isWindowsOfficePreferredExtension(extension: string) {
  return WORD_AUTOMATION_EXTENSIONS.has(extension) || POWERPOINT_AUTOMATION_EXTENSIONS.has(extension);
}

function buildWindowsOfficePdfScript(extension: string, sourcePath: string, pdfPath: string) {
  if (WORD_AUTOMATION_EXTENSIONS.has(extension)) {
    return `
$ErrorActionPreference = 'Stop'
$word = $null
$document = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $document = $word.Documents.Open('${toPowerShellLiteral(sourcePath)}', $false, $true)
  $document.ExportAsFixedFormat('${toPowerShellLiteral(pdfPath)}', 17)
} finally {
  if ($document) {
    $document.Close($false)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
  }
  if ($word) {
    $word.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
  }
}
`;
  }

  if (POWERPOINT_AUTOMATION_EXTENSIONS.has(extension)) {
    return `
$ErrorActionPreference = 'Stop'
$powerPoint = $null
$presentation = $null
try {
  $powerPoint = New-Object -ComObject PowerPoint.Application
  $presentation = $powerPoint.Presentations.Open('${toPowerShellLiteral(sourcePath)}', $true, $false, $false)
  $presentation.SaveAs('${toPowerShellLiteral(pdfPath)}', 32)
} finally {
  if ($presentation) {
    $presentation.Close()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation)
  }
  if ($powerPoint) {
    $powerPoint.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint)
  }
}
`;
  }

  return null;
}

function encodePowerShellCommand(script: string) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function toPowerShellLiteral(value: string) {
  return value.replace(/'/g, "''");
}

function normalizeLibreOfficeCliPath(executablePath: string | null) {
  if (!executablePath) {
    return null;
  }

  if (process.platform !== 'win32' || !executablePath.toLowerCase().endsWith('\\soffice.exe')) {
    return executablePath;
  }

  const consoleCandidate = executablePath.slice(0, -'.exe'.length) + '.com';
  return existsSync(consoleCandidate) ? consoleCandidate : executablePath;
}

function normalizeArchiveEntryPath(input: string) {
  const normalized = input
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => Boolean(segment) && segment !== '.');

  if (!normalized.length || normalized.some((segment) => segment === '..')) {
    throw new BadRequestException('archive entry path is invalid');
  }

  return normalized.join('/');
}

function replaceExtension(fileName: string, nextExtension: string) {
  const currentExtension = extname(fileName);
  const stem = currentExtension ? fileName.slice(0, -currentExtension.length) : fileName;
  return `${stem}${nextExtension}`;
}

async function fileExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
