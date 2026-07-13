import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ["pending", "in-progress", "completed"], default: "pending" },
  assignedTo: { type: String }, // User id (String or ObjectId)
  createdBy: { type: String },  // User id of author
  tenantId: { type: String },   // Links task to a shop
  dueDate: { type: String },
  deadline: { type: String },
  comments: [{
    text: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdByName: { type: String, default: "Staff" },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

TaskSchema.index({ tenantId: 1 });
TaskSchema.index({ assignedTo: 1 });

const Task = (mongoose.models.Task || mongoose.model("Task", TaskSchema)) as mongoose.Model<any>;
export default Task;
