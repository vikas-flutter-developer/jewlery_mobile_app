import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import {
  inventoryPhotoService,
  CatalogueValidationError,
} from "../../services/catalogue/inventoryPhotoService.js";
import { isDbConnected } from "../../../lib/serverState.js";

const auditFromRequest = (req: AuthRequest) => ({
  userId: req.user!.id,
  userEmail: req.user!.email,
  userRole: req.user!.role,
  ipAddress: req.ip,
});

export const uploadInventoryPhotos = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database connection required" });
    }

    const { skuId } = req.params;
    const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);

    const result = await inventoryPhotoService.uploadPhotos(
      skuId,
      files.map((f) => ({
        buffer: f.buffer,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
      })),
      req.user!.id,
      auditFromRequest(req)
    );

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof CatalogueValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Photo upload error:", error);
    return res.status(500).json({ success: false, error: "Failed to upload photos" });
  }
};

export const getInventoryPhotos = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database connection required" });
    }

    const result = await inventoryPhotoService.listPhotos(req.params.skuId);
    return res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof CatalogueValidationError) {
      return res.status(404).json({ success: false, error: error.message });
    }
    console.error("List photos error:", error);
    return res.status(500).json({ success: false, error: "Failed to list photos" });
  }
};

export const deleteInventoryPhoto = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database connection required" });
    }

    const result = await inventoryPhotoService.deletePhoto(
      req.params.skuId,
      req.params.photoId,
      auditFromRequest(req)
    );
    return res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof CatalogueValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Delete photo error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete photo" });
  }
};

export const setPrimaryInventoryPhoto = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database connection required" });
    }

    const inventory = await inventoryPhotoService.setPrimaryPhoto(
      req.params.skuId,
      req.params.photoId,
      auditFromRequest(req)
    );
    return res.json({ success: true, data: inventory });
  } catch (error) {
    if (error instanceof CatalogueValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Set primary photo error:", error);
    return res.status(500).json({ success: false, error: "Failed to set primary photo" });
  }
};
