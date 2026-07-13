export type StoredFile = {
  path: string;
  url: string;
  originalFilename: string;
  mimeType: string;
  size: number;
};

export interface StorageProvider {
  save(
    buffer: Buffer,
    destinationKey: string,
    originalFilename: string,
    mimeType: string
  ): Promise<StoredFile>;
  delete(filePath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
  getPublicUrl(relativePath: string): string;
}
