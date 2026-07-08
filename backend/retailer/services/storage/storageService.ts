import path from "path";
import { randomUUID } from "crypto";
import { StorageProvider, StoredFile } from "./storageTypes.js";
import { localStorageProvider } from "./localStorageProvider.js";

let activeProvider: StorageProvider = localStorageProvider;

export const setStorageProvider = (provider: StorageProvider) => {
  activeProvider = provider;
};

export const getStorageProvider = (): StorageProvider => activeProvider;

export const storageService = {
  saveInventoryPhoto: async (
    buffer: Buffer,
    skuId: string,
    originalFilename: string,
    mimeType: string
  ): Promise<StoredFile> => {
    const ext = path.extname(originalFilename) || ".jpg";
    const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
    const key = `inventory-photos/${skuId}/${filename}`;
    return activeProvider.save(buffer, key, originalFilename, mimeType);
  },

  saveImportErrorReport: async (
    buffer: Buffer,
    importId: string,
    originalFilename: string
  ): Promise<StoredFile> => {
    const key = `import-reports/${importId}/errors.csv`;
    return activeProvider.save(buffer, key, originalFilename, "text/csv");
  },

  saveBarcodePdf: async (buffer: Buffer, printJobId: string): Promise<StoredFile> => {
    const key = `barcode-pdfs/${printJobId}.pdf`;
    return activeProvider.save(buffer, key, `${printJobId}.pdf`, "application/pdf");
  },

  saveJobCardPdf: async (buffer: Buffer, jobCardId: string): Promise<StoredFile> => {
    const key = `jobcards/${jobCardId}.pdf`;
    return activeProvider.save(buffer, key, `${jobCardId}.pdf`, "application/pdf");
  },

  deleteFile: (filePath: string) => activeProvider.delete(filePath),
  getPublicUrl: (relativePath: string) => activeProvider.getPublicUrl(relativePath),
};
