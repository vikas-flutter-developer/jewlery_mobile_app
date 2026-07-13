import mongoose from "mongoose";
import { readPlatformStore, writePlatformStore } from "./platformStore.js";
import { SuperAdminSecurityAudit } from "../superadmin/models/index.js";

export interface SecurityAuditEntry {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
}

const createAuditId = () => `SEC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export const logSecurityEvent = async (
  actor: string,
  action: string,
  entityId: string,
  details = ""
): Promise<SecurityAuditEntry> => {
  const entry: SecurityAuditEntry = {
    id: createAuditId(),
    actor: actor || "unknown",
    action: action || "security-event",
    entityType: "security",
    entityId: entityId || "unknown",
    details: details || "",
    createdAt: new Date().toISOString(),
  };

  try {
    if (mongoose.connection.readyState === 1) {
      await SuperAdminSecurityAudit.create(entry);
    }
  } catch (error) {
    console.error("Failed to append security audit to MongoDB:", error);
  }

  try {
    const document = await readPlatformStore();
    document.auditLogs.unshift(entry as any);
    if (document.auditLogs.length > 200) {
      document.auditLogs = document.auditLogs.slice(0, 200);
    }
    await writePlatformStore(document);
  } catch (error) {
    console.error("Failed to append security audit to fallback platform store:", error);
  }

  return entry;
};

export const listSecurityEvents = async (
  options: { actor?: string; entityId?: string; limit?: number } = {}
): Promise<SecurityAuditEntry[]> => {
  const { actor, entityId, limit = 50 } = options;
  const events: SecurityAuditEntry[] = [];

  try {
    const document = await readPlatformStore();
    const filtered = (Array.isArray(document.auditLogs) ? document.auditLogs : [])
      .filter((item: any) => item.entityType === "security")
      .filter((item: any) => (!actor || item.actor === actor) && (!entityId || item.entityId === entityId));
    events.push(...filtered.map((item: any) => ({
      id: item.id,
      actor: item.actor,
      action: item.action,
      entityType: item.entityType,
      entityId: item.entityId,
      details: item.details,
      createdAt: item.createdAt,
    })));
  } catch (error) {
    console.error("Failed to read security events from platform store:", error);
  }

  if (mongoose.connection.readyState === 1) {
    try {
      const query: Record<string, unknown> = { entityType: "security" };
      if (actor) query.actor = actor;
      if (entityId) query.entityId = entityId;
      const records = await SuperAdminSecurityAudit.find(query).sort({ createdAt: -1 }).limit(limit).lean();
      for (const item of records) {
        if (!events.some((existing) => existing.id === item.id)) {
          events.push({
            id: item.id,
            actor: item.actor,
            action: item.action,
            entityType: item.entityType,
            entityId: item.entityId,
            details: item.details,
            createdAt: item.createdAt,
          });
        }
      }
    } catch (error) {
      console.error("Failed to read security events from MongoDB:", error);
    }
  }

  return events
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
};
