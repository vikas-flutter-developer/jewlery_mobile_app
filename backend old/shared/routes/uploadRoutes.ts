import express from "express";
import path from "path";
import multer from "multer";
import { handleUpload, prepareUploadFolder } from "../controllers/upload/uploadController.js";

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const { uploadDir } = prepareUploadFolder(req);
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || ".bin");
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.post("/", upload.single("file"), handleUpload);

export default router;


