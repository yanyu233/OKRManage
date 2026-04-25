import { BadRequestException, Inject, Injectable, StreamableFile } from '@nestjs/common';
import { extname } from 'node:path';
import JSZip = require('jszip');
import { AuditService } from '../audit/audit.service';
import { normalizeUploadedFileName } from '../../shared/http/upload-file-name';
import { LocalProofStorageService } from '../../infrastructure/storage/local-proof-storage.service';
import { ProofArchiveService } from '../../infrastructure/storage/proof-archive.service';
import {
  AllOkrRecord,
  LEADER_REPOSITORY,
  LeaderBulkScoreInput,
  LeaderScoreType,
  LeaderRepository
} from '../../infrastructure/repositories/leader/leader.repository';
import { AuthUser } from '../../shared/types/auth-user';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';
import { buildSafeProofPreviewFileName, classifyProofPreview } from '../../shared/proof/proof-links';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { LeaderPublicNoticeDocxService } from './leader-public-notice-docx.service';

@Injectable()
export class LeaderService {
  constructor(
    @Inject(LEADER_REPOSITORY) private readonly leaderRepository: LeaderRepository,
    private readonly proofStorage: LocalProofStorageService,
    private readonly proofArchive: ProofArchiveService,
    private readonly auditService: AuditService,
    private readonly runtimeConfig: RuntimeConfigService,
    private readonly publicNoticeDocxService: LeaderPublicNoticeDocxService
  ) {}

  getAllOkr(actor: AuthUser, year: number, quarter: number): Promise<AllOkrRecord> {
    this.validateQuarter(year, quarter);
    return this.leaderRepository.getAllOkr(actor, year, quarter);
  }

  getWorkbench(
    actor: AuthUser,
    year: number,
    quarter: number,
    scoreType: LeaderScoreType,
    employeeId?: string,
    goalId?: string
  ) {
    this.validateQuarter(year, quarter);
    return this.leaderRepository.getWorkbench(actor, year, quarter, scoreType, employeeId, goalId);
  }

  async updateKeyResultScore(actor: AuthUser, krId: string, score: number, comment?: string) {
    const result = await this.leaderRepository.updateKeyResultScore(actor, krId, score, comment?.trim() || null);
    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'leader.kr.score.update',
      entityType: 'key-result',
      entityId: krId,
      beforeJson: result.before,
      afterJson: {
        reviewScore: result.after.reviewScore,
        reviewComment: result.after.reviewComment
      }
    });
    return result.after;
  }

  async batchScore(actor: AuthUser, input: LeaderBulkScoreInput) {
    this.validateQuarter(input.year, input.quarter);
    if (input.entries?.length) {
      for (const entry of input.entries) {
        if (!Number.isFinite(entry.score) || entry.score < 0) {
          throw new DomainValidationError('invalid bulk score');
        }
      }
    }
    if (input.score !== null && input.score !== undefined) {
      if (!Number.isFinite(input.score) || input.score < 0) {
        throw new DomainValidationError('invalid bulk score');
      }
    }

    const result = await this.leaderRepository.batchScore(actor, {
      ...input,
      comment: input.comment?.trim() || null
    });

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'leader.kr.bulk-score.update',
      entityType: 'key-result',
      entityId: null,
      afterJson: {
        year: input.year,
        quarter: input.quarter,
        appliedScore: input.score ?? 'full',
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount
      }
    });

    return result;
  }

  async updateProofKnowledge(actor: AuthUser, proofId: string, isKnowledge: boolean) {
    const result = await this.leaderRepository.updateProofKnowledge(actor, proofId, isKnowledge);

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'leader.proof.knowledge.update',
      entityType: 'proof',
      entityId: proofId,
      beforeJson: result.before,
      afterJson: {
        isKnowledge: result.after.isKnowledge
      }
    });

    return result.after;
  }

  getKnowledgeBase(actor: AuthUser) {
    return this.leaderRepository.getKnowledgeBase(actor);
  }

  async downloadKnowledgeProofs(actor: AuthUser, proofIds: string[]) {
    const normalizedIds = Array.from(new Set(proofIds.map((proofId) => proofId.trim()).filter((proofId) => proofId.length > 0)));
    if (!normalizedIds.length) {
      throw new DomainValidationError('at least one knowledge entry must be selected');
    }

    const proofs = await this.leaderRepository.getKnowledgeEntryDownloads(actor, normalizedIds);
    const zip = new JSZip();
    const usedPaths = new Set<string>();

    for (const [index, proof] of proofs.entries()) {
      const buffer = await this.proofStorage.readBuffer(proof.storageKey);
      const zipPath = ensureUniqueZipPath(
        [
          sanitizeZipSegment(proof.employeeName, '员工'),
          sanitizeZipSegment(`${proof.goalCode}-${proof.goalName}`, `目标-${index + 1}`),
          sanitizeZipSegment(`${proof.keyResultCode}-${proof.keyResultName}`, `关键结果-${index + 1}`),
          sanitizeZipSegment(proof.fileName, `proof-${index + 1}`)
        ].join('/'),
        usedPaths
      );

      zip.file(zipPath, buffer);
    }

    const archive = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
      }
    });

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'leader.knowledge-proof.bulk-download',
      entityType: 'proof',
      entityId: null,
      afterJson: {
        proofCount: proofs.length
      }
    });

    return {
      fileName: buildKnowledgeArchiveFileName(new Date()),
      file: new StreamableFile(archive)
    };
  }

  async updateKnowledgeProof(
    actor: AuthUser,
    proofId: string,
    file?: { originalname: string; buffer: Buffer } | undefined,
    note?: string | null
  ) {
    let stored:
      | {
          storageKey: string;
          fileSize: number;
          fileName: string;
        }
      | undefined;

    if (file?.originalname && Buffer.isBuffer(file.buffer)) {
      const fileName = normalizeUploadedFileName(file.originalname);
      const saved = await this.proofStorage.save(fileName, file.buffer);
      stored = {
        ...saved,
        fileName
      };
    }

    try {
      const result = await this.leaderRepository.updateKnowledgeProof(actor, proofId, {
        fileName: stored?.fileName,
        storageKey: stored?.storageKey,
        fileSize: stored?.fileSize,
        note: note?.trim() || null
      });

      if (result.previousStorageKey) {
        await this.proofStorage.delete(result.previousStorageKey);
      }

      await this.auditService.write({
        actorUserId: actor.id,
        actorRoleCode: actor.role,
        action: 'leader.knowledge-proof.update',
        entityType: 'proof',
        entityId: proofId,
        beforeJson: {
          fileName: result.before.fileName,
          note: result.before.note
        },
        afterJson: {
          fileName: result.after.fileName,
          note: result.after.note
        }
      });

      return result.after;
    } catch (error) {
      if (stored?.storageKey) {
        await this.proofStorage.delete(stored.storageKey);
      }

      throw error;
    }
  }

  async uploadManualKnowledgeAsset(
    actor: AuthUser,
    file: { originalname: string; buffer: Buffer } | undefined,
    note?: string | null
  ) {
    if (!file || !file.originalname || !Buffer.isBuffer(file.buffer)) {
      throw new DomainValidationError('knowledge file is required');
    }

    const fileName = normalizeUploadedFileName(file.originalname);
    const stored = await this.proofStorage.save(fileName, file.buffer);

    try {
      const result = await this.leaderRepository.createManualKnowledgeAsset(actor, {
        fileName,
        storageKey: stored.storageKey,
        fileSize: stored.fileSize,
        note: note?.trim() || null
      });

      await this.auditService.write({
        actorUserId: actor.id,
        actorRoleCode: actor.role,
        action: 'leader.knowledge-asset.upload',
        entityType: 'knowledge-asset',
        entityId: result.id,
        afterJson: {
          fileName: result.fileName,
          fileSize: result.fileSize
        }
      });

      return result;
    } catch (error) {
      await this.proofStorage.delete(stored.storageKey);
      throw error;
    }
  }

  async updateManualKnowledgeAsset(
    actor: AuthUser,
    assetId: string,
    file?: { originalname: string; buffer: Buffer } | undefined,
    note?: string | null
  ) {
    let stored:
      | {
          storageKey: string;
          fileSize: number;
          fileName: string;
        }
      | undefined;

    if (file?.originalname && Buffer.isBuffer(file.buffer)) {
      const fileName = normalizeUploadedFileName(file.originalname);
      const saved = await this.proofStorage.save(fileName, file.buffer);
      stored = {
        ...saved,
        fileName
      };
    }

    try {
      const result = await this.leaderRepository.updateManualKnowledgeAsset(actor, assetId, {
        fileName: stored?.fileName,
        storageKey: stored?.storageKey,
        fileSize: stored?.fileSize,
        note: note?.trim() || null
      });

      if (result.previousStorageKey) {
        await this.proofStorage.delete(result.previousStorageKey);
      }

      await this.auditService.write({
        actorUserId: actor.id,
        actorRoleCode: actor.role,
        action: 'leader.knowledge-asset.update',
        entityType: 'knowledge-asset',
        entityId: assetId,
        beforeJson: {
          fileName: result.before.fileName,
          note: result.before.note
        },
        afterJson: {
          fileName: result.after.fileName,
          note: result.after.note
        }
      });

      return result.after;
    } catch (error) {
      if (stored?.storageKey) {
        await this.proofStorage.delete(stored.storageKey);
      }

      throw error;
    }
  }

  async deleteManualKnowledgeAsset(actor: AuthUser, assetId: string) {
    const result = await this.leaderRepository.deleteManualKnowledgeAsset(actor, assetId);
    await this.proofStorage.delete(result.storageKey);

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'leader.knowledge-asset.delete',
      entityType: 'knowledge-asset',
      entityId: assetId,
      beforeJson: {
        fileName: result.fileName,
        note: result.note
      }
    });
  }

  async downloadManualKnowledgeAsset(actor: AuthUser, assetId: string) {
    const asset = await this.leaderRepository.getManualKnowledgeAssetDownload(actor, assetId);
    const stream = await this.proofStorage.open(asset.storageKey);

    return {
      fileName: asset.fileName,
      file: new StreamableFile(stream)
    };
  }

  async getManualKnowledgeAssetArchive(actor: AuthUser, assetId: string) {
    const asset = await this.leaderRepository.getManualKnowledgeAssetDownload(actor, assetId);

    if (!isKnowledgeAssetArchiveFile(asset.fileName)) {
      throw new BadRequestException('knowledge archive preview is only supported for ZIP files');
    }

    const entries = await this.proofArchive.listEntries(asset.storageKey);

    return {
      assetId,
      fileName: asset.fileName,
      downloadUrl: buildKnowledgeAssetDownloadUrl(assetId),
      entryCount: entries.length,
      entries: entries.map((entry) => ({
        path: entry.path,
        name: entry.name,
        fileSize: entry.fileSize,
        extension: entry.extension,
        previewUrl: buildKnowledgeAssetArchiveEntryPreviewUrl(assetId, entry.path),
        downloadUrl: buildKnowledgeAssetArchiveEntryDownloadUrl(assetId, entry.path)
      }))
    };
  }

  async downloadManualKnowledgeAssetArchiveEntry(actor: AuthUser, assetId: string, entryPath: string) {
    const asset = await this.leaderRepository.getManualKnowledgeAssetDownload(actor, assetId);

    if (!isKnowledgeAssetArchiveFile(asset.fileName)) {
      throw new BadRequestException('knowledge archive preview is only supported for ZIP files');
    }

    const entry = await this.proofArchive.openEntry(asset.storageKey, entryPath);

    return {
      fileName: entry.fileName,
      file: new StreamableFile(entry.file)
    };
  }

  async resolveManualKnowledgeAssetDirectPreviewUrl(assetId: string, entryPath?: string | null) {
    const asset = await this.leaderRepository.getManualKnowledgeAssetStorage(assetId);
    const normalizedEntryPath = entryPath?.trim() ? normalizeKnowledgeArchiveEntryPath(entryPath) : null;
    const fileName = normalizedEntryPath
      ? await this.resolveManualKnowledgeArchiveEntryName(asset.storageKey, asset.fileName, normalizedEntryPath)
      : asset.fileName;
    const previewFileName = buildSafeProofPreviewFileName(
      fileName,
      normalizedEntryPath ? `knowledge:${assetId}:${normalizedEntryPath}` : `knowledge:${assetId}`
    );
    const classification = classifyProofPreview(fileName, {
      allowArchive: !normalizedEntryPath
    });

    if (classification.mode === 'archive') {
      return buildKnowledgeAssetArchivePageUrl(assetId, this.runtimeConfig.webBaseUrl);
    }

    if (classification.mode === 'kkfileview') {
      return buildKnowledgeAssetKkFileViewPreviewUrl({
        assetId,
        entryPath: normalizedEntryPath ?? undefined,
        fileName,
        previewFileName,
        sourceBaseUrl: this.runtimeConfig.kkFileViewSourceBaseUrl,
        previewBaseUrl: this.runtimeConfig.kkFileViewPublicBaseUrl,
        previewToken: this.runtimeConfig.kkFileViewPreviewToken,
        officePreviewType: classification.officePreviewType
      });
    }

    return buildKnowledgeAssetSourceUrl({
      assetId,
      entryPath: normalizedEntryPath ?? undefined,
      fileName,
      previewFileName,
      sourceBaseUrl: this.runtimeConfig.kkFileViewSourceBaseUrl,
      previewToken: this.runtimeConfig.kkFileViewPreviewToken
    });
  }

  async getManualKnowledgeAssetPreviewSource(assetId: string, entryPath?: string | null) {
    const asset = await this.leaderRepository.getManualKnowledgeAssetStorage(assetId);

    if (entryPath?.trim()) {
      const entry = await this.proofArchive.openEntry(asset.storageKey, entryPath);

      return {
        fileName: entry.fileName,
        file: new StreamableFile(entry.file)
      };
    }

    const stream = await this.proofStorage.open(asset.storageKey);

    return {
      fileName: asset.fileName,
      file: new StreamableFile(stream)
    };
  }

  getRanking(actor: AuthUser, year: number, quarter: number, reviewGroupId?: string, employeeId?: string) {
    this.validateQuarter(year, quarter);
    return this.leaderRepository.getRanking(actor, year, quarter, reviewGroupId, employeeId);
  }

  async saveRankingTieBreak(
    actor: AuthUser,
    input: {
      year: number;
      quarter: number;
      reviewGroupId: string;
      groupKey: string;
      orderedEmployeeIds: string[];
    }
  ) {
    this.validateQuarter(input.year, input.quarter);

    await this.leaderRepository.saveRankingTieBreakDecision({
      year: input.year,
      quarter: input.quarter,
      reviewGroupId: input.reviewGroupId,
      groupKey: input.groupKey,
      orderedEmployeeIds: input.orderedEmployeeIds,
      decidedByUserId: actor.id
    });

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'leader.ranking.tie-break.save',
      entityType: 'leader-ranking',
      entityId: input.groupKey,
      afterJson: {
        year: input.year,
        quarter: input.quarter,
        reviewGroupId: input.reviewGroupId,
        orderedEmployeeIds: input.orderedEmployeeIds
      }
    });

    return { ok: true };
  }

  async downloadQuarterlyPublicNotice(actor: AuthUser, year: number, quarter: number, reviewGroupId?: string) {
    this.validateQuarter(year, quarter);
    const notice = await this.leaderRepository.getQuarterlyPublicNotice(actor, year, quarter, reviewGroupId);
    const result = await this.publicNoticeDocxService.buildQuarterlyNotice(notice);

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'leader.ranking.public-notice.download',
      entityType: 'leader-ranking',
      entityId: null,
      afterJson: {
        year,
        quarter,
        reviewGroupId: reviewGroupId ?? null,
        rowCount: notice.entries.length
      }
    });

    return {
      fileName: result.fileName,
      file: new StreamableFile(result.buffer)
    };
  }

  getAnnualRanking(actor: AuthUser, year: number, employeeId?: string) {
    this.validateYear(year);
    return this.leaderRepository.getAnnualRanking(actor, year, employeeId);
  }

  async downloadAnnualPublicNotice(
    actor: AuthUser,
    year: number,
    sectionId?: string | null,
    reviewGroupId?: string | null
  ) {
    this.validateYear(year);
    const notice = await this.leaderRepository.getAnnualPublicNotice(actor, year, sectionId, reviewGroupId);
    const result = await this.publicNoticeDocxService.buildAnnualNotice(notice);

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'leader.annual-ranking.public-notice.download',
      entityType: 'leader-annual-ranking',
      entityId: null,
      afterJson: {
        year,
        sectionId: sectionId ?? null,
        reviewGroupId: reviewGroupId ?? null,
        rowCount: notice.entries.length
      }
    });

    return {
      fileName: result.fileName,
      file: new StreamableFile(result.buffer)
    };
  }

  private validateQuarter(year: number, quarter: number) {
    this.validateYear(year);

    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      throw new DomainValidationError('invalid quarter');
    }
  }

  private validateYear(year: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new DomainValidationError('invalid year');
    }
  }

  private async resolveManualKnowledgeArchiveEntryName(storageKey: string, archiveFileName: string, entryPath: string) {
    if (!isKnowledgeAssetArchiveFile(archiveFileName)) {
      throw new BadRequestException('knowledge archive preview is only supported for ZIP files');
    }

    const entries = await this.proofArchive.listEntries(storageKey);
    const entry = entries.find((item) => item.path === entryPath);

    if (!entry) {
      throw new BadRequestException('archive entry not found');
    }

    return entry.name;
  }
}

function sanitizeZipSegment(value: string | null | undefined, fallback: string) {
  const normalized = (value ?? '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .trim();

  return normalized || fallback;
}

function ensureUniqueZipPath(initialPath: string, usedPaths: Set<string>) {
  if (!usedPaths.has(initialPath)) {
    usedPaths.add(initialPath);
    return initialPath;
  }

  const extension = extname(initialPath);
  const stem = extension ? initialPath.slice(0, -extension.length) : initialPath;
  let counter = 2;
  let candidate = `${stem} (${counter})${extension}`;

  while (usedPaths.has(candidate)) {
    counter += 1;
    candidate = `${stem} (${counter})${extension}`;
  }

  usedPaths.add(candidate);
  return candidate;
}

function buildKnowledgeAssetSourceUrl(options: {
  assetId: string;
  fileName: string;
  previewFileName?: string;
  sourceBaseUrl: string;
  previewToken: string;
  entryPath?: string;
}) {
  const sourceUrl = new URL(`/api/internal/knowledge-assets/${options.assetId}/source`, options.sourceBaseUrl);
  sourceUrl.searchParams.set('accessToken', options.previewToken);
  sourceUrl.searchParams.set('fullfilename', options.previewFileName ?? options.fileName);
  if (options.entryPath) {
    sourceUrl.searchParams.set('entryPath', options.entryPath);
  }
  return sourceUrl.toString();
}

function buildKnowledgeAssetKkFileViewPreviewUrl(options: {
  assetId: string;
  fileName: string;
  previewFileName?: string;
  sourceBaseUrl: string;
  previewBaseUrl: string;
  previewToken: string;
  entryPath?: string;
  officePreviewType?: 'pdf' | 'image' | 'html';
}) {
  const sourceUrl = buildKnowledgeAssetSourceUrl({
    assetId: options.assetId,
    fileName: options.fileName,
    previewFileName: options.previewFileName,
    sourceBaseUrl: options.sourceBaseUrl,
    previewToken: options.previewToken,
    entryPath: options.entryPath
  });
  const encodedSourceUrl = Buffer.from(sourceUrl, 'utf8').toString('base64');
  const normalizedPreviewBaseUrl = options.previewBaseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams();
  params.set('url', encodedSourceUrl);
  if (options.officePreviewType) {
    params.set('officePreviewType', options.officePreviewType);
  }

  return `${normalizedPreviewBaseUrl}/onlinePreview?${params.toString()}`;
}

function buildKnowledgeAssetDownloadUrl(assetId: string) {
  return `/leader/knowledge-base/assets/${assetId}/download`;
}

function buildKnowledgeAssetArchivePageUrl(assetId: string, webBaseUrl: string) {
  return new URL(`/knowledge-base/archive/${assetId}`, webBaseUrl).toString();
}

function buildKnowledgeAssetArchiveEntryPreviewUrl(assetId: string, entryPath: string) {
  const params = new URLSearchParams();
  params.set('entryPath', entryPath);
  return `/leader/knowledge-base/assets/${assetId}/preview?${params.toString()}`;
}

function buildKnowledgeAssetArchiveEntryDownloadUrl(assetId: string, entryPath: string) {
  const params = new URLSearchParams();
  params.set('entryPath', entryPath);
  return `/leader/knowledge-base/assets/${assetId}/archive/entry?${params.toString()}`;
}

function isKnowledgeAssetArchiveFile(fileName: string) {
  return extname(fileName).toLowerCase() === '.zip';
}

function normalizeKnowledgeArchiveEntryPath(input: string) {
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

function buildKnowledgeArchiveFileName(date: Date) {
  const timestamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('');
  const time = [String(date.getHours()).padStart(2, '0'), String(date.getMinutes()).padStart(2, '0')].join('');

  return `知识库资料_${timestamp}_${time}.zip`;
}
