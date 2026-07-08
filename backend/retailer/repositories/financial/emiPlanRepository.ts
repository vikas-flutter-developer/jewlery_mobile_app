import { ClientSession } from "mongoose";
import { EmiPlan } from "../../models/index.js";

export const emiPlanRepository = {
  async findByEmiPlanId(emiPlanId: string, session?: ClientSession | null) {
    const query = EmiPlan.findOne({ emiPlanId });
    if (session) query.session(session);
    return query;
  },

  async findByInvoiceId(invoiceId: string, session?: ClientSession | null) {
    const query = EmiPlan.findOne({ invoiceId });
    if (session) query.session(session);
    return query;
  },

  async save(plan: any, session?: ClientSession | null) {
    return plan.save({ session: session || undefined });
  },
};
