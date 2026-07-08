import mongoose from "mongoose";

const hallmarkBatchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true },
  name: String,
  items: [
    {
      itemId: String,
      description: String,
      grossWeight: Number,
      netWeight: Number,
      purity: String,
    }
  ],
  hallmarkDate: { type: Date, default: Date.now },
  status: { type: String, default: "CREATED" },
  createdAt: { type: Date, default: Date.now }
});

const HallmarkBatch = (mongoose.models.HallmarkBatch || mongoose.model("HallmarkBatch", hallmarkBatchSchema)) as mongoose.Model<any>;
export default HallmarkBatch;
