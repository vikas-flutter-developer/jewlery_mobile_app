import mongoose from "mongoose";

const moodboardImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  filename: { type: String, required: true },
  uploadedBy: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const designMoodboardSchema = new mongoose.Schema(
  {
    moodboardId: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    customerId: { type: String, index: true },
    uploadedBy: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    images: { type: [moodboardImageSchema], default: [] },
    tags: { type: [String], default: [] },
    status: { type: String, enum: ["ACTIVE", "ARCHIVED"], default: "ACTIVE", index: true }
  },
  { timestamps: true }
);

const DesignMoodboard = (mongoose.models.DesignMoodboard || mongoose.model("DesignMoodboard", designMoodboardSchema)) as mongoose.Model<any>;
export default DesignMoodboard;
