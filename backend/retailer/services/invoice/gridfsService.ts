import mongoose from "mongoose";
import { Readable } from "stream";
import { Response } from "express";

/**
 * Returns the underlying Db instance from the active mongoose connection.
 * Falls back to mongoose.connection.db.
 */
function getDb(): mongoose.mongo.Db {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB not connected — GridFS unavailable");
  }
  return db;
}

/**
 * Stores a Buffer in GridFS under the given filename.
 * Returns the new file's ObjectId.
 */
export async function storeBuffer(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<mongoose.Types.ObjectId> {
  const db = getDb();
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "invoices" });

  return new Promise<mongoose.Types.ObjectId>((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: { uploadedAt: new Date(), contentType },
    });

    uploadStream.on("error", reject);
    uploadStream.on("finish", () => {
      resolve(uploadStream.id as mongoose.Types.ObjectId);
    });

    const readable = Readable.from(buffer);
    readable.pipe(uploadStream);
  });
}

/**
 * Streams a GridFS file directly to an Express Response.
 * Sets Content-Type and Content-Disposition headers automatically.
 */
export async function streamFile(
  fileId: mongoose.Types.ObjectId | string,
  res: Response,
  downloadFilename?: string
): Promise<void> {
  const db = getDb();
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "invoices" });

  const objectId =
    typeof fileId === "string"
      ? new mongoose.Types.ObjectId(fileId)
      : fileId;

  // Fetch metadata to get content type
  const files = await bucket.find({ _id: objectId }).toArray();
  if (files.length === 0) {
    throw new Error(`GridFS file not found: ${fileId}`);
  }

  const fileDoc = files[0];
  const contentType = (fileDoc as any).metadata?.contentType || "application/pdf";
  const filename = downloadFilename || fileDoc.filename;

  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(filename)}"`
  );

  const downloadStream = bucket.openDownloadStream(objectId);
  downloadStream.on("error", (err) => {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Failed to stream PDF" });
    }
  });

  downloadStream.pipe(res);
}

/**
 * Deletes a GridFS file by ObjectId.
 */
export async function deleteFile(
  fileId: mongoose.Types.ObjectId | string
): Promise<void> {
  const db = getDb();
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "invoices" });
  const objectId =
    typeof fileId === "string"
      ? new mongoose.Types.ObjectId(fileId)
      : fileId;
  await bucket.delete(objectId);
}
