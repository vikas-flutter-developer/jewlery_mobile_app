import { ClientSession } from "mongoose";
import { PaymentLedger } from "../../models/index.js";

export const paymentLedgerRepository = {
  async create(data: Record<string, unknown>, session?: ClientSession | null) {
    const docs = await PaymentLedger.create([data], session ? { session } : undefined);
    return docs[0];
  },

  async findByTransactionId(transactionId: string, session?: ClientSession | null) {
    const query = PaymentLedger.findOne({ transactionId, status: { $ne: "REVERSED" } });
    if (session) query.session(session);
    return query;
  },

  async findByInvoiceId(invoiceId: string) {
    return PaymentLedger.find({ invoiceId }).sort({ createdAt: -1 }).lean();
  },

  async markReversed(transactionId: string, reversedBy: string, session?: ClientSession | null) {
    return PaymentLedger.findOneAndUpdate(
      { transactionId },
      { $set: { status: "REVERSED", reversedBy } },
      { new: true, session: session || undefined }
    );
  },

  async findActiveByInvoice(invoiceId: string, session?: ClientSession | null) {
    const query = PaymentLedger.find({
      invoiceId,
      status: "COMPLETED",
    }).sort({ createdAt: -1 });
    if (session) query.session(session);
    return query.lean();
  },
};
