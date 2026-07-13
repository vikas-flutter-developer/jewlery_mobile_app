import { Karikar, Notification } from '../../retailer/models/index.js';

export const karikarRepository = {
  async findById(id: string) {
    return Karikar.findById(id).lean();
  },
  async findByEmail(email: string) {
    return Karikar.findOne({ email }).lean();
  },
  async updateById(id: string, update: Record<string, unknown>) {
    return Karikar.findByIdAndUpdate(id, update, { new: true }).lean();
  },
  async listNotifications(karikarId: string) {
    return Notification.find({ relatedEntityId: karikarId }).sort({ createdAt: -1 }).lean();
  },
};
