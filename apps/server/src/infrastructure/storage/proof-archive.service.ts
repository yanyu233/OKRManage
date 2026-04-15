import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, posix, resolve } from 'node:path';
import JSZip = require('jszip');
import { LocalProofStorageService } from './local-proof-storage.service';

export type ProofArchiveEntry = {
  path: string;
  name: string;
  fileSize: number | null;
  extension: string | null;
};

@Injectable()
export class ProofArchiveService {
  constructor(private readonly proofStorage: LocalProofStorageService) {}

  async listEntries(storageKey: string): Promise<ProofArchiveEntry[]> {
    const archive = await this.loadArchive(storageKey);

    return Object.values(archive.files)
      .filter((entry) => !entry.dir)
      .map((entry) => {
        const normalizedPath = normalizeArchiveEntryPath(entry.name);
        const zipEntry = entry as typeof entry & { _data?: { uncompressedSize?: number } };

        return {
          path: normalizedPath,
          name: posix.basename(normalizedPath),
          fileSize: typeof zipEntry._data?.uncompressedSize === 'number' ? zipEntry._data.uncompressedSize : null,
          extension: readLowerCaseExtension(normalizedPath)
        };
      })
      .sort((left, right) => left.path.localeCompare(right.path, 'zh-CN'));
  }

  async openEntry(storageKey: string, entryPath: string) {
    const normalizedEntryPath = normalizeArchiveEntryPath(entryPath);
    const extractedPath = await this.ensureExtractedEntry(storageKey, normalizedEntryPath);
    const extracted = await stat(extractedPath);

    return {
      fileName: posix.basename(normalizedEntryPath),
      fileSize: extracted.size,
      file: createReadStream(extractedPath)
    };
  }

  async getEntryAbsolutePath(storageKey: string, entryPath: string) {
    const normalizedEntryPath = normalizeArchiveEntryPath(entryPath);
    return this.ensureExtractedEntry(storageKey, normalizedEntryPath);
  }

  private async ensureExtractedEntry(storageKey: string, entryPath: string) {
    const extractedPath = this.resolveExtractedEntryPath(storageKey, entryPath);

    try {
      await stat(extractedPath);
      return extractedPath;
    } catch {
      // continue extracting
    }

    const archive = await this.loadArchive(storageKey);
    const entry = archive.file(entryPath);
    if (!entry) {
      throw new NotFoundException('archive entry not found');
    }

    const content = await entry.async('nodebuffer');
    await mkdir(dirname(extractedPath), { recursive: true });
    await writeFile(extractedPath, content);

    return extractedPath;
  }

  private async loadArchive(storageKey: string) {
    try {
      const buffer = await this.proofStorage.readBuffer(storageKey);
      return await JSZip.loadAsync(buffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException('proof archive could not be read');
    }
  }

  private resolveExtractedEntryPath(storageKey: string, entryPath: string) {
    const entryName = posix.basename(entryPath);
    const safeStorageKey = basename(storageKey);
    const entryHash = createHash('sha1').update(entryPath).digest('hex').slice(0, 16);
    const safeName = sanitizeExtractedFileName(entryName);
    const fullPath = resolve(join(this.cacheRoot, safeStorageKey, entryHash, safeName));

    if (!fullPath.startsWith(this.cacheRoot)) {
      throw new NotFoundException('invalid archive preview path');
    }

    return fullPath;
  }

  private get cacheRoot() {
    return resolve(join(this.proofStorage.storageRoot, '.archive-preview-cache'));
  }
}

function normalizeArchiveEntryPath(input: string) {
  const normalized = input
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => Boolean(segment) && segment !== '.');

  if (!normalized.length || normalized.some((segment) => segment === '..')) {
    throw new NotFoundException('archive entry not found');
  }

  return normalized.join('/');
}

function sanitizeExtractedFileName(fileName: string) {
  const extension = extname(fileName);
  const stem = fileName.slice(0, fileName.length - extension.length) || 'entry';
  const safeStem = stem.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'entry';
  const safeExtension = extension.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');
  return `${safeStem}${safeExtension}`;
}

function readLowerCaseExtension(filePath: string) {
  const extension = extname(filePath).toLowerCase();
  return extension ? extension.slice(1) : null;
}
