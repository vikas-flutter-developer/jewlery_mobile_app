import { ClientSession } from "mongoose";
import { BisCertificate } from "../../models/index.js";

export const bisCertificateRepository = {
  async create(data: Record<string, unknown>, session?: ClientSession | null) {
    const docs = await BisCertificate.create([data], session ? { session } : undefined);
    return docs[0];
  },

  async findByInventoryId(inventoryId: string) {
    return BisCertificate.find({ inventoryId }).sort({ createdAt: -1 }).lean();
  },

  async findActiveByInventoryId(inventoryId: string) {
    const now = new Date();
    return BisCertificate.find({
      inventoryId,
      status: "ACTIVE",
      expiryDate: { $gte: now },
    })
      .sort({ expiryDate: -1 })
      .lean();
  },

  async findActiveByBarcode(barcode: string) {
    const now = new Date();
    return BisCertificate.findOne({
      barcode,
      status: "ACTIVE",
      expiryDate: { $gte: now },
    }).lean();
  },

  async findByCertificateId(certificateId: string) {
    return BisCertificate.findOne({ certificateId }).lean();
  },

  async expirePastDue() {
    const now = new Date();
    return BisCertificate.updateMany(
      { status: "ACTIVE", expiryDate: { $lt: now } },
      { $set: { status: "EXPIRED" } }
    );
  },
};
