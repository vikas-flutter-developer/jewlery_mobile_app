import fs from "fs/promises";
import path from "path";
import { StoredFile, StorageProvider } from "./storageTypes.js";
import { getUploadsRoot } from "../../../lib/uploadsPath.js";

const UPLOADS_ROOT = getUploadsRoot();

export class LocalStorageProvider implements StorageProvider {
  private baseUrl: string;

  constructor(baseUrl = "/uploads") {
    this.baseUrl = baseUrl;
  }

  getPublicUrl(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    return `${this.baseUrl}/${normalized}`;
  }

  async save(
    buffer: Buffer,
    destinationKey: string,
    originalFilename: string,
    mimeType: string
  ): Promise<StoredFile> {
    const safeKey = destinationKey.replace(/[^a-zA-Z0-9/_\-.]/g, "_");
    const absolutePath = path.join(UPLOADS_ROOT, safeKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);

    const relativePath = safeKey.replace(/\\/g, "/");
    return {
      path: absolutePath,
      url: this.getPublicUrl(relativePath),
      originalFilename,
      mimeType,
      size: buffer.length,
    };
  }

  async delete(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const localStorageProvider = new LocalStorageProvider();
