import path from "path";
import multer from "multer";
import fs from "fs";
import { getUploadsRoot } from "../../lib/uploadsPath.js";

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_IMPORT_EXT = new Set([".xlsx", ".xls", ".csv"]);

export const inventoryPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Invalid image type. Allowed: JPG, JPEG, PNG, WEBP"));
    }
  },
});

const importDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(getUploadsRoot(), "bulk-imports", "temp");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || ".xlsx");
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

export const bulkImportUpload = multer({
  storage: importDiskStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ALLOWED_IMPORT_EXT.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid import file. Allowed: XLSX, XLS, CSV"));
    }
  },
});

export const handleMulterError = (err: any, _req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, error: "File exceeds maximum allowed size" });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, error: err.message || "Upload failed" });
  }
  next();
};
