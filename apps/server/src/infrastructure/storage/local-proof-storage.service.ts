import { Injectable, NotFoundException } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { RuntimeConfigService } from '../../modules/config/runtime-config.service';

type StoredProofFile = {
  storageKey: string;
  fileSize: number;
};

@Injectable()
export class LocalProofStorageService {
  constructor(private readonly runtimeConfig: RuntimeConfigService) {}

  async save(fileName: string, buffer: Buffer): Promise<StoredProofFile> {
    const storageKey = `${randomUUID()}-${sanitizeFileName(fileName)}`;
    const targetPath = this.resolveStoragePath(storageKey);

    await mkdir(this.storageRoot, { recursive: true });
    await writeFile(targetPath, buffer);

    const written = await stat(targetPath);

    return {
      storageKey,
      fileSize: written.size
    };
  }

  async saveSeedFile(storageKey: string, content: string | Buffer): Promise<void> {
    const targetPath = this.resolveStoragePath(storageKey);
    await mkdir(this.storageRoot, { recursive: true });
    await writeFile(targetPath, content);
  }

  async open(storageKey: string) {
    const targetPath = this.resolveStoragePath(storageKey);

    try {
      await stat(targetPath);
    } catch {
      throw new NotFoundException('proof file not found');
    }

    return createReadStream(targetPath);
  }

  async readBuffer(storageKey: string) {
    const targetPath = this.resolveStoragePath(storageKey);

    try {
      await stat(targetPath);
    } catch {
      throw new NotFoundException('proof file not found');
    }

    return readFile(targetPath);
  }

  async delete(storageKey: string): Promise<void> {
    const targetPath = this.resolveStoragePath(storageKey);
    await unlink(targetPath).catch(() => undefined);
  }

  async getAbsolutePath(storageKey: string) {
    const targetPath = this.resolveStoragePath(storageKey);

    try {
      await stat(targetPath);
    } catch {
      throw new NotFoundException('proof file not found');
    }

    return targetPath;
  }

  get storageRoot(): string {
    return resolve(process.cwd(), this.runtimeConfig.proofStorageDir);
  }

  private resolveStoragePath(storageKey: string): string {
    const safeKey = basename(storageKey);
    const fullPath = resolve(join(this.storageRoot, safeKey));

    if (!fullPath.startsWith(this.storageRoot)) {
      throw new NotFoundException('invalid proof path');
    }

    return fullPath;
  }
}

function sanitizeFileName(fileName: string): string {
  const baseName = basename(fileName);
  const extension = extname(baseName);
  const stem = baseName.slice(0, baseName.length - extension.length) || 'proof';
  const safeStem = stem.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, '');
  return `${safeStem}${safeExtension}`.replace(/^_+/, '') || 'proof.bin';
}
