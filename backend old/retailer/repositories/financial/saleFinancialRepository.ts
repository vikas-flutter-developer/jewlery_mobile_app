import { ClientSession } from "mongoose";
import { Sale } from "../../models/index.js";

export type SaleFinancialStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "REFUNDED" | "PARTIALLY_REFUNDED";

export const deriveFinancialStatus = (
  invoiceTotal: number,
  amountPaid: number
): SaleFinancialStatus => {
  if (amountPaid <= 0) return "UNPAID";
  if (amountPaid >= invoiceTotal) return "PAID";
  return "PARTIALLY_PAID";
};

export const saleFinancialRepository = {
  async findByOrderId(orderId: string, session?: ClientSession | null) {
    const query = Sale.findOne({ orderId });
    if (session) query.session(session);
    return query;
  },

  async updateFinancials(
    orderId: string,
    update: {
      amountPaid: number;
      amountOutstanding: number;
      financialStatus: SaleFinancialStatus;
      payments?: Array<{ method: string; amount: number; reference?: string }>;
      allowOutstanding?: boolean;
    },
    session?: ClientSession | null
  ) {
    return Sale.findOneAndUpdate(
      { orderId },
      { $set: update },
      { new: true, session: session || undefined }
    );
  },
};
