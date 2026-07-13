import mongoose from "mongoose";
import Inventory from "./Inventory.js";
import Sale from "./Sale.js";
import Rate from "./Rate.js";
import Khata from "./Khata.js";
import Order from "./Order.js";
import Karikar from "./Karikar.js";
import User from "./User.js";
import Branch from "./Branch.js";
import Customer from "./Customer.js";
import Vendor from "./Vendor.js";
import GemstoneParcel from "./GemstoneParcel.js";
import MetalMelting from "./MetalMelting.js";
import { SchemeDefinition, SchemeEnrollment } from "./Scheme.js";
import Design from "./Design.js";
import Wishlist from "./Wishlist.js";
import Task from "./Task.js";
import RepairJob from "./RepairJob.js";
import SupportTicket from "./SupportTicket.js";
import CashDenomination from "./CashDenomination.js";
import ShiftSchedule from "./ShiftSchedule.js";
import ConsignmentStock from "./ConsignmentStock.js";
import ChequeEmi from "./ChequeEmi.js";
import RFIDTag from "./RFIDTag.js";
import Form60 from "./Form60.js";
import PortalCheckout from "./PortalCheckout.js";
import RetailerOrder from "./RetailerOrder.js";
import Installment from "./Installment.js";
import KarikarAuditLog from "./KarikarAuditLog.js";
import DesignMoodboard from "./DesignMoodboard.js";
import DesignMoodboardAuditLog from "./DesignMoodboardAuditLog.js";
import DesignApproval from "./DesignApproval.js";
import DesignApprovalAuditLog from "./DesignApprovalAuditLog.js";
import DesignRevision from "./DesignRevision.js";
import NotificationSchema from "./Notification.js";
import OrderTracking from "./OrderTracking.js";
import CustomerReferral from "./CustomerReferral.js";
import MakingChargeRule from "./MakingChargeRule.js";
import FinancialYear from "./FinancialYear.js";

const Notification = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema, "notifications");

export {
  Inventory,
  Sale,
  Rate,
  Khata,
  Order,
  Karikar,
  User,
  Branch,
  Customer,
  Vendor,
  GemstoneParcel,
  MetalMelting,
  SchemeDefinition,
  SchemeEnrollment,
  Design,
  Wishlist,
  Task,
  RepairJob,
  SupportTicket,
  CashDenomination,
  ShiftSchedule,
  ConsignmentStock,
  ChequeEmi,
  RFIDTag,
  Form60,
  PortalCheckout,
  RetailerOrder,
  Installment,
  KarikarAuditLog,
  DesignMoodboard,
  DesignMoodboardAuditLog,
  DesignApproval,
  DesignApprovalAuditLog,
  DesignRevision,
  Notification,
  OrderTracking,
  CustomerReferral,
  MakingChargeRule,
  FinancialYear
};



