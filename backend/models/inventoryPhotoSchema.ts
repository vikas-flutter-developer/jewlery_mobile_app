import mongoose from "mongoose";

const inventoryPhotoSchema = new mongoose.Schema(
  {
    photoId: { type: String, required: true },
    url: { type: String, required: true },
    originalFilename: { type: String, required: true },
    uploadedBy: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    isPrimary: { type: Boolean, default: false },
    mimeType: { type: String },
    size: { type: Number },
  },
  { _id: false }
);

export { inventoryPhotoSchema };
export default inventoryPhotoSchema;
