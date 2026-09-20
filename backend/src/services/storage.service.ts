import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';
import { createPublicId } from '../utils/ids';

export interface StoredFile {
  storageProvider: string;
  storageKey: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface StorageProvider {
  upload(input: { buffer: Buffer; originalName: string; mimeType: string }): Promise<StoredFile>;
}

class LocalStorageProvider implements StorageProvider {
  constructor(private directory: string) {}

  async upload(input: { buffer: Buffer; originalName: string; mimeType: string }): Promise<StoredFile> {
    const key = `${createPublicId()}-${input.originalName.replace(/\s+/g, '-')}`;
    const destDir = path.resolve(process.cwd(), this.directory);
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(path.join(destDir, key), input.buffer);
    return {
      storageProvider: 'local',
      storageKey: key,
      url: `/uploads/${key}`,
      fileName: input.originalName,
      mimeType: input.mimeType,
      size: input.buffer.length,
    };
  }
}

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!provider) {
    provider = new LocalStorageProvider(env.storageLocalDir);
  }
  return provider;
}
