import fs from "fs/promises";
import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { bulkImportService } from "../../services/catalogue/bulkImportService.js";
import { importHistoryRepository } from "../../repositories/catalogue/inventoryCatalogueRepository.js";
import { CatalogueValidationError } from "../../services/catalogue/inventoryPhotoService.js";
import { isDbConnected } from "../../../lib/serverState.js";

const auditFromRequest = (req: AuthRequest) => ({
  userId: req.user!.id,
  userEmail: req.user!.email,
  userRole: req.user!.role,
  ipAddress: req.ip,
});

export const bulkImportInventory = async (req: AuthRequest, res: Response) => {
  let tempPath: string | undefined;
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database connection required" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "Import file is required" });
    }

    tempPath = req.file.path;
    const result = await bulkImportService.processImport(
      tempPath,
      req.file.originalname,
      req.user!.id,
      auditFromRequest(req)
    );

    return res.status(201).json({
      success: true,
      data: {
        importId: result.importId,
        importedCount: result.importedCount,
        skippedCount: result.skippedCount,
        failedCount: result.failedCount,
        totalRows: result.totalRows,
        processingTimeMs: result.processingTimeMs,
        status: result.status,
        errorReportUrl: result.errorReportUrl,
        errors: result.errors,
      },
    });
  } catch (error) {
    if (error instanceof CatalogueValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Bulk import error:", error);
    return res.status(500).json({ success: false, error: "Bulk import failed" });
  } finally {
    if (tempPath) {
      try {
        await fs.unlink(tempPath);
      } catch {
        /* ignore cleanup errors */
      }
    }
  }
};

export const getImportHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database connection required" });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await importHistoryRepository.findAll(page, limit);

    return res.json({
      success: true,
      data: result.items,
      pagination: { page: result.page, limit: result.limit, total: result.total },
    });
  } catch (error) {
    console.error("Import history error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch import history" });
  }
};

export const getImportHistoryById = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database connection required" });
    }

    const record = await importHistoryRepository.findByImportId(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: "Import record not found" });
    }

    return res.json({ success: true, data: record });
  } catch (error) {
    console.error("Import history detail error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch import record" });
  }
};
