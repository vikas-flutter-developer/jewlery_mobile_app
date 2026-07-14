import mongoose from "mongoose";

const invoiceItemSchema = new mongoose.Schema(
  {
    barcode: { type: String },
    name: { type: String, required: true },
    hsnCode: { type: String, default: "7113" }, // Jewellery HSN
    description: { type: String },
    metalType: { type: String }, // GOLD / SILVER / PLATINUM
    purity: { type: String },    // 22K, 18K, 916, etc.
    grossWeight: { type: Number, default: 0 },
    netWeight: { type: Number, default: 0 },
    stoneWeight: { type: Number, default: 0 },
    goldRate: { type: Number, default: 0 },      // Rate per gram
    goldAmount: { type: Number, default: 0 },    // netWeight * goldRate
    makingCharge: { type: Number, default: 0 },  // Per item or per gram
    makingChargeType: { type: String, enum: ["FLAT", "PER_GRAM"], default: "FLAT" },
    stoneCharge: { type: Number, default: 0 },
    otherCharge: { type: Number, default: 0 },
    bisNumber: { type: String },                 // BIS hallmark certificate / HUID
    price: { type: Number, required: true },     // Line total before GST
    qty: { type: Number, default: 1 },
    taxableValue: { type: Number, default: 0 },
    gstRate: { type: Number, default: 3 },       // Default jewellery GST 3%
    cgstRate: { type: Number, default: 1.5 },
    sgstRate: { type: Number, default: 1.5 },
    igstRate: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    itemTotal: { type: Number, default: 0 },     // price + GST
  },
  { _id: false }
);

const gstBreakupSchema = new mongoose.Schema(
  {
    cgstRate: { type: Number, default: 1.5 },
    sgstRate: { type: Number, default: 1.5 },
    igstRate: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    totalGst: { type: Number, default: 0 },
    taxableValue: { type: Number, default: 0 },
  },
  { _id: false }
);

const paymentEntrySchema = new mongoose.Schema(
  {
    method: { type: String, required: true },
    amount: { type: Number, required: true },
    reference: { type: String },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    invoiceSeriesId: { type: mongoose.Schema.Types.ObjectId, ref: "InvoiceSeries" },
    saleId: { type: String, index: true },                // orderId from Sale
    type: {
      type: String,
      enum: ["GST", "ADVANCE", "PROFORMA"],
      default: "GST",
      required: true,
    },

    // Shop snapshot at time of print
    storeProfile: {
      shopName: String,
      address: String,
      city: String,
      state: String,
      pincode: String,
      gstin: String,
      pan: String,
      phone: String,
      email: String,
      bisLicence: String,
      logo: String,
    },

    // Customer details
    customerInfo: {
      name: { type: String, default: "Walk-in Customer" },
      phone: String,
      email: String,
      address: String,
      city: String,
      state: String,
      pincode: String,
      gstin: String,
      pan: String,
      aadhar: String,
    },

    items: { type: [invoiceItemSchema], default: [] },

    // Totals
    subtotal: { type: Number, default: 0 },      // Sum of item prices before GST
    discount: { type: Number, default: 0 },
    exchangeDiscount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 }, // subtotal - discount
    gstBreakup: { type: gstBreakupSchema, default: () => ({}) },
    tcs: { type: Number, default: 0 },           // TCS for high-value (>2L)
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    payments: { type: [paymentEntrySchema], default: [] },

    // For advance receipts
    advanceAmount: { type: Number, default: 0 },
    advanceOrderRef: { type: String },

    // GridFS storage IDs
    pdfGridfsId: { type: mongoose.Schema.Types.ObjectId },          // A4 GST PDF
    thermalPdfGridfsId58: { type: mongoose.Schema.Types.ObjectId }, // 58mm thermal
    thermalPdfGridfsId80: { type: mongoose.Schema.Types.ObjectId }, // 80mm thermal

    status: {
      type: String,
      enum: ["draft", "final", "cancelled"],
      default: "final",
    },

    branchCode: { type: String, default: "MAIN" },
    tenantId: { type: String, index: true },
    financialYear: { type: String },
    taxProfileId: { type: String },
  },
  { timestamps: true }
);

const Invoice = (mongoose.models.Invoice ||
  mongoose.model("Invoice", invoiceSchema)) as mongoose.Model<any>;

export default Invoice;
