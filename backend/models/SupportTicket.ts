import mongoose from "mongoose";

const SupportTicketSchema = new mongoose.Schema({
  shopName: { type: String, required: true },
  customerName: { type: String },
  customerId: { type: String },
  email: { type: String },
  title: { type: String },
  description: { type: String },
  subject: { type: String },
  content: { type: String },
  status: { 
    type: String, 
    enum: ["OPEN", "IN_PROGRESS", "RESOLVED"], 
    default: "OPEN" 
  },
  category: { 
    type: String, 
    enum: ["BILLING", "TECHNICAL", "INVENTORY", "OTHER"], 
    default: "OTHER" 
  },
  replies: [{
    message: { type: String, required: true },
    senderRole: { type: String, enum: ["SUPER_ADMIN", "USER"], required: true },
    sender: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const SupportTicket = (mongoose.models.SupportTicket || mongoose.model("SupportTicket", SupportTicketSchema)) as mongoose.Model<any>;
export default SupportTicket;
