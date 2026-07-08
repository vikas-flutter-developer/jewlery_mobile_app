import path from "path";
import fs from "fs";
import { Request, Response } from "express";
import {
  findInventoryById,
  generateCertificateId,
  logComplianceEvent,
} from "../../services/compliance/complianceEngineService.js";
import { bisCertificateRepository } from "../../repositories/compliance/bisCertificateRepository.js";
import { isDbConnected } from "../../../lib/serverState.js";

const parseDate = (value: unknown, fieldName: string) => {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return date;
};

export const postBisCertificate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { certificateNumber, issueDate, expiryDate, notes, createdBy } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: "inventory id is required" });
    }
    if (!certificateNumber || !issueDate || !expiryDate) {
      return res.status(400).json({
        success: false,
        error: "certificateNumber, issueDate, and expiryDate are required",
      });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database connection required" });
    }

    const inventory = await findInventoryById(id);
    if (!inventory) {
      return res.status(404).json({ success: false, error: "Inventory item not found" });
    }

    const parsedIssueDate = parseDate(issueDate, "issueDate");
    const parsedExpiryDate = parseDate(expiryDate, "expiryDate");

    if (parsedExpiryDate <= parsedIssueDate) {
      return res.status(400).json({
        success: false,
        error: "expiryDate must be after issueDate",
      });
    }

    let uploadedFile: string | undefined;
    let originalFileName: string | undefined;
    let mimeType: string | undefined;

    if (req.file) {
      uploadedFile = req.file.path;
      originalFileName = req.file.originalname;
      mimeType = req.file.mimetype;
    } else if (req.body.uploadedFile) {
      uploadedFile = String(req.body.uploadedFile);
      originalFileName = req.body.originalFileName ? String(req.body.originalFileName) : undefined;
    }

    const inventoryId = String(inventory._id);
    const certificateId = generateCertificateId();
    const status = parsedExpiryDate >= new Date() ? "ACTIVE" : "EXPIRED";

    const certificate = await bisCertificateRepository.create({
      certificateId,
      inventoryId,
      barcode: inventory.barcode,
      certificateNumber: String(certificateNumber).trim(),
      issueDate: parsedIssueDate,
      expiryDate: parsedExpiryDate,
      uploadedFile,
      originalFileName,
      mimeType,
      status,
      notes: notes ? String(notes) : undefined,
      createdBy: createdBy ? String(createdBy) : undefined,
    });

    await logComplianceEvent({
      actionType: "BIS_CERTIFICATE_ADDED",
      status: "PASSED",
      entityType: "INVENTORY",
      entityId: inventoryId,
      message: `BIS certificate ${certificateNumber} added`,
      details: {
        certificateId,
        certificateNumber,
        expiryDate: parsedExpiryDate,
        barcode: inventory.barcode,
      },
      userId: createdBy ? String(createdBy) : undefined,
    });

    return res.status(201).json({ success: true, data: certificate });
  } catch (error) {
    console.error("BIS certificate upload error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to add BIS certificate",
    });
  }
};

export const getInventoryCertificates = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, error: "inventory id is required" });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database connection required" });
    }

    const inventory = await findInventoryById(id);
    if (!inventory) {
      return res.status(404).json({ success: false, error: "Inventory item not found" });
    }

    await bisCertificateRepository.expirePastDue();
    const certificates = await bisCertificateRepository.findByInventoryId(String(inventory._id));

    return res.json({
      success: true,
      data: {
        inventoryId: String(inventory._id),
        barcode: inventory.barcode,
        name: inventory.name,
        huid: inventory.huid,
        hallmarkCertificate: inventory.hallmarkCertificate,
        certificates,
      },
    });
  } catch (error) {
    console.error("Get certificates error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch certificates",
    });
  }
};

export const prepareBisUploadFolder = (req: Request) => {
  const inventoryId = String(req.params.id || "general");
  const sanitized = inventoryId.replace(/[^a-zA-Z0-9_-]+/g, "-");
  const uploadDir = path.resolve(process.cwd(), "backend", "uploads", "bis-certificates", sanitized);
  fs.mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
};
