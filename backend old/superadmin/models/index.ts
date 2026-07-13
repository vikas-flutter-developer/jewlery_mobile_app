import mongoose from "mongoose";
import { superAdminDb } from "../../lib/db.js";
import User from "../../models/User.js";
import SupportTicket from "../../models/SupportTicket.js";
import SubscriptionSchema from "./Subscription.js";
import DemoAccessSchema from "./DemoAccess.js";
import SecurityAuditSchema from "./SecurityAudit.js";
import SubscriptionPlanSchema from "./SubscriptionPlan.js";
import StoreSubscriptionSchema from "./StoreSubscription.js";
import PaymentHistorySchema from "./PaymentHistory.js";
import FeatureFlagSchema from "./FeatureFlag.js";

export const SuperAdminUser = (superAdminDb.models.GlobalUser || superAdminDb.model("GlobalUser", User.schema, "globalusers")) as mongoose.Model<any>;
export const SuperAdminSupportTicket = (superAdminDb.models.SupportTicket || superAdminDb.model("SupportTicket", SupportTicket.schema, "supporttickets")) as mongoose.Model<any>;
export const SuperAdminSubscription = (superAdminDb.models.Subscription || superAdminDb.model("Subscription", SubscriptionSchema, "subscriptions")) as mongoose.Model<any>;
export const SuperAdminDemoAccess = (superAdminDb.models.DemoAccess || superAdminDb.model("DemoAccess", DemoAccessSchema, "demoaccesses")) as mongoose.Model<any>;
export const SuperAdminSecurityAudit = (superAdminDb.models.SecurityAudit || superAdminDb.model("SecurityAudit", SecurityAuditSchema, "securityaudits")) as mongoose.Model<any>;

// ── SaaS Subscription Module models ─────────────────────────────────────────
export const SuperAdminSubscriptionPlan = (superAdminDb.models.SubscriptionPlan || superAdminDb.model("SubscriptionPlan", SubscriptionPlanSchema, "subscriptionplans")) as mongoose.Model<any>;
export const SuperAdminStoreSubscription = (superAdminDb.models.StoreSubscription || superAdminDb.model("StoreSubscription", StoreSubscriptionSchema, "storesubscriptions")) as mongoose.Model<any>;
export const SuperAdminPaymentHistory = (superAdminDb.models.PaymentHistory || superAdminDb.model("PaymentHistory", PaymentHistorySchema, "paymenthistories")) as mongoose.Model<any>;
export const SuperAdminFeatureFlag = (superAdminDb.models.FeatureFlag || superAdminDb.model("FeatureFlag", FeatureFlagSchema, "featureflags")) as mongoose.Model<any>;
