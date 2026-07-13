import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Customer from "../models/Customer.js";
import Sale from "../models/Sale.js";
import PaymentLedger from "../models/PaymentLedger.js";
import AdvanceDeposit from "../models/AdvanceDeposit.js";
import EmiPlan from "../models/EmiPlan.js";
import FinanceAuditLog from "../models/FinanceAuditLog.js";
import Khata from "../models/Khata.js";
import Inventory from "../models/Inventory.js";
import Branch from "../models/Branch.js";
import Vendor from "../models/Vendor.js";
import ImportHistory from "../models/ImportHistory.js";
import BarcodePrintHistory from "../models/BarcodePrintHistory.js";
import CatalogueAuditLog from "../models/CatalogueAuditLog.js";
import WastageReconciliation from "../models/WastageReconciliation.js";
import JobCard from "../models/JobCard.js";
import KarikarWageLedger from "../models/KarikarWageLedger.js";
import Order from "../models/Order.js";
import DesignApproval from "../models/DesignApproval.js";
import DesignApprovalAuditLog from "../models/DesignApprovalAuditLog.js";
import CostEstimateAuditLog from "../models/CostEstimateAuditLog.js";
import DesignRevision from "../models/DesignRevision.js";
import CostEstimate from "../models/CostEstimate.js";
import NotificationSchema from "../models/Notification.js";
import OrderTracking from "../models/OrderTracking.js";
import CustomerReferral from "../models/CustomerReferral.js";
import MakingChargeRule from "../models/MakingChargeRule.js";
import FinancialYear from "../models/FinancialYear.js";


let mongoReplSet: MongoMemoryReplSet;

export const registerRetailerModels = () => {
  const retailerConn = mongoose.connection.useDb("retailer", { useCache: true });
  if (!retailerConn.models.Customer) retailerConn.model("Customer", Customer.schema, "customers");
  if (!retailerConn.models.Sale) retailerConn.model("Sale", Sale.schema, "sales");
  if (!retailerConn.models.PaymentLedger)
    retailerConn.model("PaymentLedger", PaymentLedger.schema, "paymentledgers");
  if (!retailerConn.models.AdvanceDeposit)
    retailerConn.model("AdvanceDeposit", AdvanceDeposit.schema, "advancedeposits");
  if (!retailerConn.models.EmiPlan) retailerConn.model("EmiPlan", EmiPlan.schema, "emiplans");
  if (!retailerConn.models.FinanceAuditLog)
    retailerConn.model("FinanceAuditLog", FinanceAuditLog.schema, "financeauditlogs");
  if (!retailerConn.models.Khata) retailerConn.model("Khata", Khata.schema, "khata");
  if (!retailerConn.models.Inventory) retailerConn.model("Inventory", Inventory.schema, "inventory");
  if (!retailerConn.models.Branch) retailerConn.model("Branch", Branch.schema, "branches");
  if (!retailerConn.models.Vendor) retailerConn.model("Vendor", Vendor.schema, "vendors");
  if (!retailerConn.models.ImportHistory)
    retailerConn.model("ImportHistory", ImportHistory.schema, "importhistories");
  if (!retailerConn.models.BarcodePrintHistory)
    retailerConn.model("BarcodePrintHistory", BarcodePrintHistory.schema, "barcodeprinthistories");
  if (!retailerConn.models.CatalogueAuditLog)
    retailerConn.model("CatalogueAuditLog", CatalogueAuditLog.schema, "catalogueauditlogs");
  if (!retailerConn.models.WastageReconciliation)
    retailerConn.model("WastageReconciliation", WastageReconciliation.schema, "wastagereconciliations");
  if (!retailerConn.models.JobCard) retailerConn.model("JobCard", JobCard.schema, "jobcards");
  if (!retailerConn.models.KarikarWageLedger)
    retailerConn.model("KarikarWageLedger", KarikarWageLedger.schema, "karikarwageledgers");
  if (!retailerConn.models.Order) retailerConn.model("Order", Order.schema, "orders");
  if (!retailerConn.models.DesignApproval) retailerConn.model("DesignApproval", DesignApproval.schema, "designapprovals");
  if (!retailerConn.models.DesignApprovalAuditLog) retailerConn.model("DesignApprovalAuditLog", DesignApprovalAuditLog.schema, "designapprovalauditlogs");
  if (!retailerConn.models.CostEstimateAuditLog) retailerConn.model("CostEstimateAuditLog", CostEstimateAuditLog.schema, "costestimateauditlogs");
  if (!retailerConn.models.DesignRevision) retailerConn.model("DesignRevision", DesignRevision.schema, "designrevisions");
  if (!retailerConn.models.CostEstimate) retailerConn.model("CostEstimate", CostEstimate.schema, "costestimates");
  if (!retailerConn.models.Notification) retailerConn.model("Notification", NotificationSchema, "notifications");
  if (!retailerConn.models.OrderTracking) retailerConn.model("OrderTracking", OrderTracking.schema, "ordertrackings");
  if (!retailerConn.models.CustomerReferral) retailerConn.model("CustomerReferral", CustomerReferral.schema, "customerreferrals");
  if (!retailerConn.models.MakingChargeRule) retailerConn.model("MakingChargeRule", MakingChargeRule.schema, "makingchargerules");
  if (!retailerConn.models.FinancialYear) retailerConn.model("FinancialYear", FinancialYear.schema, "financialyears");
  return retailerConn;
};



beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const uri = mongoReplSet.getUri();
  await mongoose.connect(uri);
  registerRetailerModels();
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplSet) {
    await mongoReplSet.stop();
  }
});

afterEach(async () => {
  const retailerConn = mongoose.connection.useDb("retailer", { useCache: true });
  const collections = retailerConn.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});
