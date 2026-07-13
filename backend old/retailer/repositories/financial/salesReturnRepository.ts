import { ClientSession } from "mongoose";
import { SalesReturn } from "../../models/index.js";

export const salesReturnRepository = {
  async create(data: Record<string, unknown>, session?: ClientSession | null) {
    const docs = await SalesReturn.create([data], session ? { session } : undefined);
    return docs[0];
  },

  async findByReturnId(returnId: string, session?: ClientSession | null) {
    const query = SalesReturn.findOne({ returnId });
    if (session) query.session(session);
    return query;
  },

  async save(record: any, session?: ClientSession | null) {
    return record.save({ session: session || undefined });
  },

  async findAll() {
    return SalesReturn.find().sort({ createdAt: -1 }).lean();
  },
};
