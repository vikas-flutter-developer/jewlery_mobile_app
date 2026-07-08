import fs from "fs";
import path from "path";
import { Request, Response } from "express";

const sanitizeFolder = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim() : "";
  const sanitized = raw.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "general";
};

const getUploadFolder = (req: Request) => sanitizeFolder(req.body?.folder);

export const prepareUploadFolder = (req: Request) => {
  const folder = getUploadFolder(req);
  const uploadDir = path.resolve(process.cwd(), "backend", "uploads", folder);
  fs.mkdirSync(uploadDir, { recursive: true });
  return { folder, uploadDir };
};

export const handleUpload = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "file is required",
      });
    }

    const { folder } = prepareUploadFolder(req);

    return res.status(201).json({
      success: true,
      data: {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        folder,
        path: req.file.path,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to process upload", error);
    return res.status(500).json({
      success: false,
      error: "Failed to process upload",
    });
  }
};


