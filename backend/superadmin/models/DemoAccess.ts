import mongoose from "mongoose";

const DemoAccessSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  otp: { type: String, required: true },
  updatedAt: { type: String, required: true }
});

export default DemoAccessSchema;
