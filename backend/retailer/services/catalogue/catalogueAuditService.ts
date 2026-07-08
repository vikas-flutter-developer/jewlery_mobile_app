import { randomUUID } from "crypto";
import { ClientSession } from "mongoose";
import { Inventory, CatalogueAuditLog } from "../../models/index.js";

export type AuditContext = {
  userId: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
};

export const catalogueAuditService = {
  async log(
    action: string,
    entityId: string | undefined,
    context: AuditContext,
    metadata?: Record<string, unknown>,
    session?: ClientSession | null
  ) {
    const doc = {
      auditId: `CAT-AUD-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`,
      action,
      entityType: "INVENTORY",
      entityId,
      userId: context.userId,
      userEmail: context.userEmail,
      userRole: context.userRole,
      metadata,
      ipAddress: context.ipAddress,
      createdAt: new Date(),
    };

    if (session) {
      await CatalogueAuditLog.create([doc], { session });
    } else {
      await CatalogueAuditLog.create(doc);
    }
    return doc;
  },
};

export const findInventoryBySkuId = async (skuId: string, session?: ClientSession | null) => {
  const isObjectId = /^[a-f\d]{24}$/i.test(skuId);
  const filter = {
    $or: [{ sku: skuId }, { barcode: skuId }, ...(isObjectId ? [{ _id: skuId }] : [])],
  };

  const query = Inventory.findOne(filter);
  if (session) query.session(session);
  return query.lean();
};

export const normalizeInventoryListItem = (item: any) => {
  if (!item) return item;
  const thumbnail =
    item.thumbnail ||
    item.primaryPhoto ||
    item.image ||
    (Array.isArray(item.photos) && item.photos.find((p: any) => p.isPrimary)?.url) ||
    (Array.isArray(item.photos) && item.photos[0]?.url) ||
    null;
  return { ...item, thumbnail };
};
