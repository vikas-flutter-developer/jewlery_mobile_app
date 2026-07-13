import mongoose from 'mongoose';

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, unique: true, index: true },
    supplier: { type: String, required: true, trim: true },
    item: { type: String, required: true, trim: true },
    unit: { type: Number, default: 1 },
    metal: { type: String, enum: ['Gold', 'Silver', 'Platinum'], default: 'Gold' },
    purity: { type: String, enum: ['24K', '22K', '18K', '14K', '925', 'Other'], default: '22K' },
    weight: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    makingCharges: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 3 },
    total: { type: Number, default: 0 },
    invoiceNumber: { type: String, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'RECEIVED', 'INSPECT', 'CANCELLED'],
      default: 'PENDING',
    },
    receivedAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);


export default (mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', purchaseOrderSchema, 'purchaseorders')) as mongoose.Model<any>;

