/**
 * planService.ts
 * Business logic for SubscriptionPlan management.
 * Validates inputs, enforces business rules, emits audit logs.
 */
import { planRepository, CreatePlanDto, UpdatePlanDto } from "../repositories/planRepository.js";
import { SuperAdminSecurityAudit } from "../../models/index.js";

// ── Audit helper ─────────────────────────────────────────────────────────────

export const auditLog = async (
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  ipAddress?: string
) => {
  try {
    await SuperAdminSecurityAudit.create({
      id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`,
      actor,
      action,
      entityType,
      entityId,
      details,
      ipAddress: ipAddress || "",
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write audit record:", err);
  }
};

// ── Validation helpers ────────────────────────────────────────────────────────

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const validatePlanDto = (dto: Partial<CreatePlanDto>): string | null => {
  if (dto.name !== undefined && !dto.name.trim()) return "Plan name must not be empty";
  if (dto.slug !== undefined) {
    const slug = dto.slug.toLowerCase().trim();
    if (!SLUG_REGEX.test(slug)) return "Plan slug must be lowercase alphanumeric with hyphens only (e.g. gold-annual)";
  }
  if (dto.price !== undefined && (typeof dto.price !== "number" || dto.price < 0))
    return "Plan price must be a non-negative number";
  if (dto.durationMonths !== undefined && (!Number.isInteger(dto.durationMonths) || dto.durationMonths < 1))
    return "durationMonths must be a positive integer";
  if (dto.maxUsers !== undefined && (!Number.isInteger(dto.maxUsers) || dto.maxUsers < 1))
    return "maxUsers must be a positive integer";
  if (dto.maxBranches !== undefined && (!Number.isInteger(dto.maxBranches) || dto.maxBranches < 1))
    return "maxBranches must be a positive integer";
  return null;
};

// ── Service methods ───────────────────────────────────────────────────────────

export const planService = {
  async listPlans(onlyActive = false) {
    return planRepository.findAll(onlyActive);
  },

  async getPlan(id: string) {
    const plan = await planRepository.findById(id);
    if (!plan) throw { statusCode: 404, message: "Subscription plan not found" };
    return plan;
  },

  async createPlan(dto: CreatePlanDto, actor: string, ip?: string) {
    // Validate
    const validationError = validatePlanDto(dto);
    if (validationError) throw { statusCode: 400, message: validationError };

    // Duplicate slug check
    const existing = await planRepository.findBySlug(dto.slug);
    if (existing) throw { statusCode: 409, message: `A plan with slug "${dto.slug}" already exists` };

    const plan = await planRepository.create(dto);

    await auditLog(actor, "plan.create", "plan", String(plan._id), `Created plan "${plan.name}" (${plan.slug})`, ip);

    return plan;
  },

  async updatePlan(id: string, dto: UpdatePlanDto, actor: string, ip?: string) {
    // Validate
    const validationError = validatePlanDto(dto);
    if (validationError) throw { statusCode: 400, message: validationError };

    // Duplicate slug check (only if slug is being changed)
    if (dto.slug) {
      const existing = await planRepository.findBySlug(dto.slug);
      if (existing && String(existing._id) !== id) {
        throw { statusCode: 409, message: `A plan with slug "${dto.slug}" already exists` };
      }
    }

    const updated = await planRepository.update(id, dto);
    if (!updated) throw { statusCode: 404, message: "Subscription plan not found" };

    await auditLog(actor, "plan.update", "plan", id, `Updated plan "${updated.name}"`, ip);

    return updated;
  },

  async deletePlan(id: string, hard: boolean, actor: string, ip?: string) {
    const plan = await planRepository.findById(id);
    if (!plan) throw { statusCode: 404, message: "Subscription plan not found" };

    await planRepository.delete(id, hard);

    const action = hard ? "plan.hard_delete" : "plan.deactivate";
    await auditLog(actor, action, "plan", id, `${hard ? "Hard deleted" : "Deactivated"} plan "${plan.name}"`, ip);
  },
};
