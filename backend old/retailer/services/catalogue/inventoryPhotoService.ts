import { randomUUID } from "crypto";
import fs from "fs/promises";
import { inventoryCatalogueRepository } from "../../repositories/catalogue/inventoryCatalogueRepository.js";
import { storageService } from "../storage/storageService.js";
import { catalogueAuditService, AuditContext } from "./catalogueAuditService.js";

const MAX_PHOTOS_PER_SKU = 10;
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export class CatalogueValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogueValidationError";
  }
}

type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
  path?: string;
};

const syncPhotoMetadata = (photos: any[]) => {
  const primary = photos.find((p) => p.isPrimary) || photos[0];
  return {
    photos,
    photoCount: photos.length,
    primaryPhoto: primary?.url || null,
    thumbnail: primary?.url || null,
    image: primary?.url || undefined,
    lastPhotoUpdatedAt: new Date(),
  };
};

export const inventoryPhotoService = {
  validateImage(file: UploadedFile) {
    if (!ALLOWED_MIME.has(file.mimetype.toLowerCase())) {
      throw new CatalogueValidationError(`Invalid image type: ${file.mimetype}. Allowed: JPG, JPEG, PNG, WEBP`);
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new CatalogueValidationError("Image exceeds maximum size of 5 MB");
    }
  },

  async uploadPhotos(
    skuId: string,
    files: UploadedFile[],
    uploadedBy: string,
    audit: AuditContext
  ) {
    if (!files.length) {
      throw new CatalogueValidationError("At least one image file is required");
    }

    const inventory = await inventoryCatalogueRepository.findBySkuId(skuId);
    if (!inventory) {
      throw new CatalogueValidationError(`SKU not found: ${skuId}`);
    }

    const existingPhotos = Array.isArray(inventory.photos) ? [...inventory.photos] : [];
    if (existingPhotos.length + files.length > MAX_PHOTOS_PER_SKU) {
      throw new CatalogueValidationError(`Maximum ${MAX_PHOTOS_PER_SKU} photos allowed per SKU`);
    }

    const inventoryKey = String(inventory.sku || inventory._id);
    const newPhotos: any[] = [];

    for (const file of files) {
      this.validateImage(file);
      const buffer = file.buffer ?? (file.path ? await fs.readFile(file.path) : Buffer.alloc(0));
      const stored = await storageService.saveInventoryPhoto(
        buffer,
        inventoryKey,
        file.originalname,
        file.mimetype
      );

      newPhotos.push({
        photoId: randomUUID(),
        url: stored.url,
        originalFilename: stored.originalFilename,
        uploadedBy,
        uploadedAt: new Date(),
        isPrimary: false,
        mimeType: stored.mimeType,
        size: stored.size,
        _storagePath: stored.path,
      });
    }

    const photos = [...existingPhotos, ...newPhotos.map(({ _storagePath, ...p }) => p)];
    if (!photos.some((p) => p.isPrimary) && photos.length > 0) {
      photos[0].isPrimary = true;
    }

    const meta = syncPhotoMetadata(photos);
    inventory.photos = meta.photos;
    inventory.photoCount = meta.photoCount;
    inventory.primaryPhoto = meta.primaryPhoto;
    inventory.thumbnail = meta.thumbnail;
    inventory.image = meta.image;
    inventory.lastPhotoUpdatedAt = meta.lastPhotoUpdatedAt;
    await inventory.save();

    await catalogueAuditService.log(
      "PHOTO_UPLOAD",
      String(inventory._id),
      audit,
      { skuId: inventory.sku, photoCount: files.length }
    );

    return { inventory: inventory.toObject(), uploaded: newPhotos.length };
  },

  async listPhotos(skuId: string) {
    const inventory = await inventoryCatalogueRepository.findBySkuId(skuId);
    if (!inventory) {
      throw new CatalogueValidationError(`SKU not found: ${skuId}`);
    }
    return {
      skuId: inventory.sku,
      inventoryId: String(inventory._id),
      photos: inventory.photos || [],
      primaryPhoto: inventory.primaryPhoto,
      thumbnail: inventory.thumbnail,
      photoCount: inventory.photoCount || 0,
    };
  },

  async deletePhoto(skuId: string, photoId: string, audit: AuditContext) {
    const inventory = await inventoryCatalogueRepository.findBySkuId(skuId);
    if (!inventory) {
      throw new CatalogueValidationError(`SKU not found: ${skuId}`);
    }

    const photos = Array.isArray(inventory.photos) ? [...inventory.photos] : [];
    const target = photos.find((p) => p.photoId === photoId);
    if (!target) {
      throw new CatalogueValidationError(`Photo not found: ${photoId}`);
    }

    const remaining = photos.filter((p) => p.photoId !== photoId);
    if (remaining.length > 0 && !remaining.some((p) => p.isPrimary)) {
      remaining[0].isPrimary = true;
    }

    const meta = syncPhotoMetadata(remaining);
    inventory.photos = meta.photos;
    inventory.photoCount = meta.photoCount;
    inventory.primaryPhoto = meta.primaryPhoto;
    inventory.thumbnail = meta.thumbnail;
    inventory.image = meta.image;
    inventory.lastPhotoUpdatedAt = meta.lastPhotoUpdatedAt;
    await inventory.save();

    if (target.url) {
      const relative = target.url.replace(/^\/uploads\//, "");
      const uploadsRoot = (await import("../../../lib/uploadsPath.js")).getUploadsRoot();
      const filePath = `${uploadsRoot}/${relative}`.replace(/\//g, "/");
      await storageService.deleteFile(filePath);
    }

    await catalogueAuditService.log("PHOTO_DELETE", String(inventory._id), audit, { photoId });

    return { inventory: inventory.toObject(), deletedPhotoId: photoId };
  },

  async setPrimaryPhoto(skuId: string, photoId: string, audit: AuditContext) {
    const inventory = await inventoryCatalogueRepository.findBySkuId(skuId);
    if (!inventory) {
      throw new CatalogueValidationError(`SKU not found: ${skuId}`);
    }

    const photos = Array.isArray(inventory.photos) ? [...inventory.photos] : [];
    const target = photos.find((p) => p.photoId === photoId);
    if (!target) {
      throw new CatalogueValidationError(`Photo not found: ${photoId}`);
    }

    for (const photo of photos) {
      photo.isPrimary = photo.photoId === photoId;
    }

    const meta = syncPhotoMetadata(photos);
    inventory.photos = meta.photos;
    inventory.primaryPhoto = meta.primaryPhoto;
    inventory.thumbnail = meta.thumbnail;
    inventory.image = meta.image;
    inventory.lastPhotoUpdatedAt = meta.lastPhotoUpdatedAt;
    await inventory.save();

    await catalogueAuditService.log("PHOTO_SET_PRIMARY", String(inventory._id), audit, { photoId });

    return inventory.toObject();
  },
};
