import { Inject, Injectable, StreamableFile } from '@nestjs/common';
import { extname } from 'node:path';
import JSZip from 'jszip';
import { AuditService } from '../audit/audit.service';
import { normalizeUploadedFileName } from '../../shared/http/upload-file-name';
import { LocalProofStorageService } from '../../infrastructure/storage/local-proof-storage.service';
import {
  LEADER_REPOSITORY,
  LeaderBulkScoreInput,
  LeaderRepository
} from '../../infrastructure/repositories/leader/leader.repository';
import { AuthUser } from '../../shared/types/auth-user';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';

@Injectable()
export class LeaderService {
  constructor(
    @Inject(LEADER_REPOSITORY) private readonly leaderRepository: LeaderRepository,
    private readonly proofStorage: LocalProofStorageService,
    private readonly auditService: AuditService
  ) {}

  getWorkbench(actor: AuthUser, year: number, quarter: number, employeeId?: string, goalId?: string) {
    this.validateQuarter(year, quarter);
    return this.leaderRepository.getWorkbench(actor, year, quarter, employeeId, goalId);
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
      throw new DomainValidationError('at least one knowledge proof must be selected');
    }

    const proofs = await this.leaderRepository.getKnowledgeProofDownloads(actor, normalizedIds);
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

  getRanking(actor: AuthUser, year: number, quarter: number, reviewGroupId?: string, employeeId?: string) {
    this.validateQuarter(year, quarter);
    return this.leaderRepository.getRanking(actor, year, quarter, reviewGroupId, employeeId);
  }

  getAnnualRanking(actor: AuthUser, year: number, employeeId?: string) {
    this.validateYear(year);
    return this.leaderRepository.getAnnualRanking(actor, year, employeeId);
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
}

function sanitizeZipSegment(value: string, fallback: string) {
  const normalized = value
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

function buildKnowledgeArchiveFileName(date: Date) {
  const timestamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('');
  const time = [String(date.getHours()).padStart(2, '0'), String(date.getMinutes()).padStart(2, '0')].join('');

  return `知识库资料_${timestamp}_${time}.zip`;
}
