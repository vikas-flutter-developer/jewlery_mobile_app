import mongoose from "mongoose";

const ShiftScheduleSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  userName: { type: String, required: true },
  days: [{ type: String }],
  timeStart: { type: String, required: true },
  timeEnd: { type: String, required: true },
  shiftName: { type: String, default: "General Shift" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ShiftSchedule = (mongoose.models.ShiftSchedule || mongoose.model("ShiftSchedule", ShiftScheduleSchema)) as mongoose.Model<any>;
export default ShiftSchedule;
