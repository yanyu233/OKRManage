import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { ProofPdfPreviewService } from './proof-pdf-preview.service';
import { AuthUser } from '../../shared/types/auth-user';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';
import { normalizeUploadedFileName } from '../../shared/http/upload-file-name';
import { LocalProofStorageService } from '../../infrastructure/storage/local-proof-storage.service';
import { ProofArchiveService } from '../../infrastructure/storage/proof-archive.service';
import {
  EMPLOYEE_REPOSITORY,
  EmployeeCreateGoalInput,
  EmployeeGoalUpdateInput,
  EmployeeRepository
} from '../../infrastructure/repositories/employee/employee.repository';
import {
  buildInternalProofPdfUrl,
  buildSafeProofPreviewFileName,
  buildKkFileViewPreviewUrl,
  buildProofArchiveEntryDownloadUrl,
  buildProofArchiveEntryPreviewUrl,
  buildProofArchivePageUrl,
  buildProofDownloadUrl,
  buildProofSourceUrl,
  classifyProofPreview,
  getProofContentType,
  isArchiveProofFile
} from '../../shared/proof/proof-links';

@Injectable()
export class EmployeeService {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepository: EmployeeRepository,
    private readonly proofStorage: LocalProofStorageService,
    private readonly proofArchive: ProofArchiveService,
    private readonly proofPdfPreview: ProofPdfPreviewService,
    private readonly runtimeConfig: RuntimeConfigService,
    private readonly auditService: AuditService
  ) {}

  getQuarterOverview(actor: AuthUser, year: number, quarter: number) {
    this.validateQuarter(year, quarter);
    return this.employeeRepository.getQuarterOverview(actor, year, quarter);
  }

  getGoalTemplates(actor: AuthUser, year: number, quarter: number) {
    this.validateQuarter(year, quarter);
    return this.employeeRepository.getGoalTemplates(actor, year, quarter);
  }

  async createGoal(actor: AuthUser, input: EmployeeCreateGoalInput) {
    this.validateQuarter(input.year, input.quarter);

    const normalizedName = input.name.trim();
    if (!normalizedName) {
      throw new DomainValidationError('goal name is required');
    }

    const uniqueCodes = new Set<string>();
    for (const keyResult of input.keyResults) {
      const normalizedCode = keyResult.code.trim();
      const normalizedName = keyResult.name.trim();
      if (!normalizedCode) {
        throw new DomainValidationError('key result code is required');
      }

      if (!normalizedName) {
        throw new DomainValidationError('key result name is required');
      }

      if (uniqueCodes.has(normalizedCode.toLowerCase())) {
        throw new DomainValidationError('duplicate key result code');
      }

      uniqueCodes.add(normalizedCode.toLowerCase());
    }

    const result = await this.employeeRepository.createGoal(actor, {
      ...input,
      name: normalizedName,
      description: input.description?.trim() || null,
      keyResults: input.keyResults.map((keyResult) => ({
        code: keyResult.code.trim(),
        name: keyResult.name.trim(),
        description: keyResult.description?.trim() || null,
        points: keyResult.points,
        scoreType: keyResult.scoreType ?? 'objective'
      }))
    });

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'employee.goal.create',
      entityType: 'goal',
      entityId: result.id,
      afterJson: {
        year: result.year,
        quarter: result.quarter,
        code: result.code,
        name: result.name,
        keyResults: result.keyResults.map((keyResult) => ({
          id: keyResult.id,
          code: keyResult.code,
          scoreType: keyResult.scoreType
        }))
      }
    });

    return result;
  }

  async updateGoal(actor: AuthUser, goalId: string, input: EmployeeGoalUpdateInput) {
    const normalized = this.normalizeGoalInput(input);
    const result = await this.employeeRepository.updateGoal(actor, goalId, normalized);

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'employee.goal.update',
      entityType: 'goal',
      entityId: goalId,
      afterJson: {
        name: result.name,
        status: result.status,
        keyResults: result.keyResults.map((keyResult) => ({
          id: keyResult.id,
          code: keyResult.code,
          scoreType: keyResult.scoreType
        }))
      }
    });

    return result;
  }

  async deleteGoal(actor: AuthUser, goalId: string) {
    const result = await this.employeeRepository.deleteGoal(actor, goalId);
    await this.deleteStoredProofs(result.removedProofStorageKeys);

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'employee.goal.delete',
      entityType: 'goal',
      entityId: goalId,
      beforeJson: {
        year: result.year,
        quarter: result.quarter,
        code: result.code,
        name: result.name
      }
    });
  }

  async importGoalTemplates(actor: AuthUser, year: number, quarter: number, templateIds: string[]) {
    this.validateQuarter(year, quarter);

    const uniqueTemplateIds = [...new Set(templateIds.map((entry) => entry.trim()).filter(Boolean))];
    if (!uniqueTemplateIds.length) {
      throw new DomainValidationError('at least one template must be selected');
    }

    const result = await this.employeeRepository.importGoalTemplates(actor, year, quarter, uniqueTemplateIds);
    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'employee.goal-templates.import',
      entityType: 'goal-template-import',
      entityId: actor.id,
      afterJson: {
        year,
        quarter,
        templateIds: uniqueTemplateIds,
        importedGoalIds: result.importedGoals.map((goal) => goal.id)
      }
    });
    return result;
  }

  getGoalDetail(actor: AuthUser, goalId: string) {
    return this.employeeRepository.getGoalDetail(actor, goalId);
  }

  async deleteKeyResult(actor: AuthUser, krId: string) {
    const result = await this.employeeRepository.deleteKeyResult(actor, krId);
    await this.deleteStoredProofs(result.removedProofStorageKeys);

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'employee.kr.delete',
      entityType: 'key-result',
      entityId: krId,
      beforeJson: {
        goalId: result.goalId,
        code: result.code,
        name: result.name
      }
    });
  }

  async updateKeyResultCompletion(actor: AuthUser, krId: string, completionState: string) {
    const result = await this.employeeRepository.updateKeyResultCompletion(actor, krId, completionState);
    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'employee.kr.completion.update',
      entityType: 'key-result',
      entityId: krId,
      beforeJson: result.before,
      afterJson: {
        completionState: result.after.completionState
      }
    });
    return result.after;
  }

  async uploadProof(
    actor: AuthUser,
    krId: string,
    file: { originalname: string; buffer: Buffer } | undefined,
    note?: string | null
  ) {
    if (!file || !file.originalname || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('proof file is required');
    }

    const originalFileName = normalizeUploadedFileName(file.originalname);
    const stored = await this.proofStorage.save(originalFileName, file.buffer);

    try {
      const result = await this.employeeRepository.createProof(actor, krId, {
        fileName: originalFileName,
        storageKey: stored.storageKey,
        fileSize: stored.fileSize,
        note: note?.trim() || null
      });

      await this.auditService.write({
        actorUserId: actor.id,
        actorRoleCode: actor.role,
        action: 'employee.kr.proof.upload',
        entityType: 'proof',
        entityId: result.proof.id,
        afterJson: {
          keyResultId: result.keyResultId,
          fileName: result.proof.fileName,
          fileSize: result.proof.fileSize
        }
      });

      return result.proof;
    } catch (error) {
      await this.proofStorage.delete(stored.storageKey);
      throw error;
    }
  }

  async downloadProof(actor: AuthUser, proofId: string) {
    const proof = await this.employeeRepository.getProofDownload(actor, proofId);
    const stream = await this.proofStorage.open(proof.storageKey);

    return {
      fileName: proof.fileName,
      file: new StreamableFile(stream)
    };
  }

  async getProofArchive(actor: AuthUser, proofId: string) {
    const proof = await this.employeeRepository.getProofDownload(actor, proofId);

    if (!isArchiveProofFile(proof.fileName)) {
      throw new BadRequestException('proof archive preview is only supported for ZIP files');
    }

    const entries = await this.proofArchive.listEntries(proof.storageKey);

    return {
      proofId,
      fileName: proof.fileName,
      downloadUrl: buildProofDownloadUrl(proofId),
      entryCount: entries.length,
      entries: entries.map((entry) => ({
        path: entry.path,
        name: entry.name,
        fileSize: entry.fileSize,
        extension: entry.extension,
        previewUrl: buildProofArchiveEntryPreviewUrl({
          proofId,
          entryPath: entry.path,
          fileName: entry.name,
          sourceBaseUrl: this.runtimeConfig.kkFileViewSourceBaseUrl,
          previewBaseUrl: this.runtimeConfig.kkFileViewPublicBaseUrl,
          previewToken: this.runtimeConfig.kkFileViewPreviewToken,
          webBaseUrl: this.runtimeConfig.webBaseUrl
        }),
        downloadUrl: buildProofArchiveEntryDownloadUrl(proofId, entry.path)
      }))
    };
  }

  async getProofPreviewMeta(actor: AuthUser, proofId: string, entryPath?: string | null) {
    const proof = await this.employeeRepository.getProofDownload(actor, proofId);
    const normalizedEntryPath = entryPath ? normalizeArchiveEntryPath(entryPath) : null;
    const fileName = normalizedEntryPath
      ? await this.resolveArchiveEntryName(proof.storageKey, proof.fileName, normalizedEntryPath)
      : proof.fileName;
    const previewFileName = buildSafeProofPreviewFileName(fileName, normalizedEntryPath ? `${proofId}:${normalizedEntryPath}` : proofId);
    const classification = classifyProofPreview(fileName, {
      allowArchive: !normalizedEntryPath
    });
    const downloadUrl = normalizedEntryPath
      ? buildProofArchiveEntryDownloadUrl(proofId, normalizedEntryPath)
      : buildProofDownloadUrl(proofId);

    if (classification.mode === 'archive') {
      return {
        proofId,
        entryPath: normalizedEntryPath,
        fileName,
        mode: 'archive' as const,
        targetUrl: buildProofArchivePageUrl(proofId, this.runtimeConfig.webBaseUrl),
        fallbackUrl: null,
        downloadUrl,
        contentType: getProofContentType(fileName)
      };
    }

    if (classification.mode === 'kkfileview') {
      return {
        proofId,
        entryPath: normalizedEntryPath,
        fileName,
        mode: 'kkfileview' as const,
        targetUrl: buildKkFileViewPreviewUrl({
          proofId,
          entryPath: normalizedEntryPath ?? undefined,
          fileName,
          previewFileName,
          sourceBaseUrl: this.runtimeConfig.kkFileViewSourceBaseUrl,
          previewBaseUrl: this.runtimeConfig.kkFileViewPublicBaseUrl,
          previewToken: this.runtimeConfig.kkFileViewPreviewToken,
          officePreviewType: classification.officePreviewType
        }),
        fallbackUrl: classification.officePreviewType
          ? buildKkFileViewPreviewUrl({
              proofId,
              entryPath: normalizedEntryPath ?? undefined,
              fileName,
              previewFileName,
              sourceBaseUrl: this.runtimeConfig.kkFileViewSourceBaseUrl,
              previewBaseUrl: this.runtimeConfig.kkFileViewPublicBaseUrl,
              previewToken: this.runtimeConfig.kkFileViewPreviewToken
            })
          : null,
        downloadUrl,
        contentType: null
      };
    }

    return {
      proofId,
      entryPath: normalizedEntryPath,
      fileName,
      mode: 'native' as const,
      targetUrl: buildProofSourceUrl({
        proofId,
        entryPath: normalizedEntryPath ?? undefined,
        fileName,
        previewFileName,
        sourceBaseUrl: this.runtimeConfig.kkFileViewSourceBaseUrl,
        previewToken: this.runtimeConfig.kkFileViewPreviewToken
      }),
      fallbackUrl: null,
      downloadUrl,
      contentType: classification.contentType
    };
  }

  async downloadProofArchiveEntry(actor: AuthUser, proofId: string, entryPath: string) {
    const proof = await this.employeeRepository.getProofDownload(actor, proofId);

    if (!isArchiveProofFile(proof.fileName)) {
      throw new BadRequestException('proof archive preview is only supported for ZIP files');
    }

    const entry = await this.proofArchive.openEntry(proof.storageKey, entryPath);

    return {
      fileName: entry.fileName,
      file: new StreamableFile(entry.file)
    };
  }

  async getProofPreviewSource(proofId: string, entryPath?: string | null) {
    const proof = await this.employeeRepository.getProofStorage(proofId);

    if (entryPath?.trim()) {
      const entry = await this.proofArchive.openEntry(proof.storageKey, entryPath);

      return {
        fileName: entry.fileName,
        file: new StreamableFile(entry.file)
      };
    }

    const stream = await this.proofStorage.open(proof.storageKey);

    return {
      fileName: proof.fileName,
      file: new StreamableFile(stream)
    };
  }

  async resolveProofDirectPreviewUrl(proofId: string, entryPath?: string | null) {
    const proof = await this.employeeRepository.getProofStorage(proofId);
    const normalizedEntryPath = entryPath?.trim() ? normalizeArchiveEntryPath(entryPath) : null;
    const fileName = normalizedEntryPath
      ? await this.resolveArchiveEntryName(proof.storageKey, proof.fileName, normalizedEntryPath)
      : proof.fileName;
    const classification = classifyProofPreview(fileName, {
      allowArchive: !normalizedEntryPath
    });
    const previewFileName = buildSafeProofPreviewFileName(fileName, normalizedEntryPath ? `${proofId}:${normalizedEntryPath}` : proofId);

    if (classification.mode === 'archive') {
      return buildProofArchivePageUrl(proofId, this.runtimeConfig.webBaseUrl);
    }

    if (classification.mode === 'kkfileview') {
      if (classification.officePreviewType === 'pdf') {
        const converted = await this.proofPdfPreview.ensurePdfPreview(proofId, normalizedEntryPath);
        if (converted) {
          return buildInternalProofPdfUrl({
            proofId,
            entryPath: normalizedEntryPath ?? undefined,
            sourceBaseUrl: this.runtimeConfig.kkFileViewSourceBaseUrl,
            previewToken: this.runtimeConfig.kkFileViewPreviewToken
          });
        }
      }

      return buildKkFileViewPreviewUrl({
        proofId,
        entryPath: normalizedEntryPath ?? undefined,
        fileName,
        previewFileName,
        sourceBaseUrl: this.runtimeConfig.kkFileViewSourceBaseUrl,
        previewBaseUrl: this.runtimeConfig.kkFileViewPublicBaseUrl,
        previewToken: this.runtimeConfig.kkFileViewPreviewToken,
        officePreviewType: classification.officePreviewType
      });
    }

    return buildProofSourceUrl({
      proofId,
      entryPath: normalizedEntryPath ?? undefined,
      fileName,
      previewFileName,
      sourceBaseUrl: this.runtimeConfig.kkFileViewSourceBaseUrl,
      previewToken: this.runtimeConfig.kkFileViewPreviewToken
    });
  }

  async getProofPdfPreviewSource(proofId: string, entryPath?: string | null) {
    const converted = await this.proofPdfPreview.openPdfPreview(proofId, entryPath);
    if (!converted) {
      throw new BadRequestException('pdf preview is not available');
    }

    return {
      fileName: converted.fileName,
      file: new StreamableFile(converted.file)
    };
  }

  private async resolveArchiveEntryName(storageKey: string, archiveFileName: string, entryPath: string) {
    if (!isArchiveProofFile(archiveFileName)) {
      throw new BadRequestException('archive entry preview is only supported for ZIP files');
    }

    const entries = await this.proofArchive.listEntries(storageKey);
    const entry = entries.find((item) => item.path === entryPath);

    if (!entry) {
      throw new BadRequestException('archive entry not found');
    }

    return entry.name;
  }

  private validateQuarter(year: number, quarter: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new DomainValidationError('invalid year');
    }

    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      throw new DomainValidationError('invalid quarter');
    }
  }

  private normalizeGoalInput(input: EmployeeCreateGoalInput | EmployeeGoalUpdateInput) {
    const normalizedName = input.name.trim();
    if (!normalizedName) {
      throw new DomainValidationError('goal name is required');
    }

    const uniqueCodes = new Set<string>();
    for (const keyResult of input.keyResults) {
      const normalizedCode = keyResult.code.trim();
      const normalizedKeyResultName = keyResult.name.trim();
      if (!normalizedCode) {
        throw new DomainValidationError('key result code is required');
      }

      if (!normalizedKeyResultName) {
        throw new DomainValidationError('key result name is required');
      }

      if (uniqueCodes.has(normalizedCode.toLowerCase())) {
        throw new DomainValidationError('duplicate key result code');
      }

      uniqueCodes.add(normalizedCode.toLowerCase());
    }

    return {
      ...input,
      name: normalizedName,
      description: input.description?.trim() || null,
      keyResults: input.keyResults.map((keyResult) => ({
        ...keyResult,
        id: keyResult.id?.trim() || undefined,
        code: keyResult.code.trim(),
        name: keyResult.name.trim(),
        description: keyResult.description?.trim() || null,
        points: keyResult.points,
        scoreType: keyResult.scoreType ?? 'objective'
      }))
    };
  }

  private async deleteStoredProofs(storageKeys: string[]) {
    const uniqueStorageKeys = [...new Set(storageKeys.filter(Boolean))];
    await Promise.all(uniqueStorageKeys.map((storageKey) => this.proofStorage.delete(storageKey)));
  }
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
