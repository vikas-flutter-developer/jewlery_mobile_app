import mongoose from "mongoose";

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String }
}, { _id: false });

const orderTrackingSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
  trackingCode: { type: String, required: true, unique: true, index: true },
  publicToken: { type: String, required: true, unique: true, index: true },
  shareableUrl: { type: String, required: true },
  trackingStatus: { 
    type: String, 
    enum: [
      "ORDER_PLACED",
      "DESIGN_APPROVED",
      "IN_PRODUCTION",
      "QUALITY_CHECK",
      "READY_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED"
    ],
    default: "ORDER_PLACED"
  },
  statusTimeline: { type: [statusHistorySchema], default: [] },
  lastUpdatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const OrderTracking = mongoose.models.OrderTracking || mongoose.model("OrderTracking", orderTrackingSchema);
export default OrderTracking;
export { orderTrackingSchema };
