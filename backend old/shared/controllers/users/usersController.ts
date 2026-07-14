import { Request, Response } from "express";
import mongoose from "mongoose";
import { default as DefaultUser } from "../../../models/User.js";
import { Sale as DefaultSale, ShiftSchedule as DefaultShiftSchedule, Notification, UserActionLog } from "../../../models/index.js";
import { User as RetailerUser, Sale as RetailerSale, ShiftSchedule as RetailerShiftSchedule } from "../../../retailer/models/index.js";
import { ManufacturerUser, ManufacturerSale } from "../../../manufacturer/models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { mockSales } from "../../../data/mockData.js";
import { AuthRequest } from "../../../lib/authUtils.js";
import bcrypt from "bcryptjs";
import {
  getAllFallbackUsers,
  findFallbackUserById,
  updateFallbackUser,
  getAllFallbackSchedules,
  updateFallbackSchedule,
  addFallbackUser,
  deleteFallbackUser,
} from "../../../lib/fallbackStore.js";

const getStoreType = (req: any) => {
  if (req.user?.storeType) return req.user.storeType;
  const role = req.user?.role;
  if (role === "RETAILER") return "RETAILER";
  if (role === "ADMIN") return "MANUFACTURER";
  return "RETAILER"; // fallback
};

const getUserModel = (req: any) => {
  const storeType = getStoreType(req);
  if (storeType === "RETAILER") return RetailerUser;
  if (storeType === "MANUFACTURER") return ManufacturerUser;
  return DefaultUser;
};
const getSaleModel = (req: any) => {
  const storeType = getStoreType(req);
  if (storeType === "RETAILER") return RetailerSale;
  if (storeType === "MANUFACTURER") return ManufacturerSale;
  return DefaultSale;
};
const getShiftScheduleModel = (req: any) => {
  const storeType = getStoreType(req);
  if (storeType === "RETAILER") return RetailerShiftSchedule;
  // Manufacturer has no custom shiftschedule model registered in models index
  return DefaultShiftSchedule;
};


const ALLOWED_ROLES = ["ADMIN", "ACCOUNTANT", "SALES_STAFF", "SALES", "STORE_MANAGER", "KARIKAR", "CUSTOMER", "RETAILER"];
const ALLOWED_STATUSES = ["ACTIVE", "SUSPENDED", "INACTIVE"];

const toStringId = (value: unknown) => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toString" in value) {
    return String(value);
  }
  return undefined;
};

const normalizeUser = (user: any) => ({
  id: toStringId(user._id) || user.id || "",
  name: user.name || "",
  email: user.email || "",
  role: user.role || "CUSTOMER",
  branchId: toStringId(user.branchId) || null,
  tenantId: toStringId(user.tenantId) || null,
  phone: user.phone || null,
  status: user.status || "ACTIVE",
  permissions: Array.isArray(user.permissions) ? user.permissions : [],
  lastLogin: user.lastLogin || null,
  createdAt: user.createdAt || null,
  updatedAt: user.updatedAt || null,
  shiftHistory: Array.isArray(user.shiftHistory) ? user.shiftHistory : [],
  shiftSchedule: user.shiftSchedule || { days: [], timeStart: "", timeEnd: "", shiftName: "General Shift" },
  salesTarget: user.salesTarget ?? 100000,
  commissionRate: user.commissionRate ?? 1.0,
  passwordResetRequired: user.passwordResetRequired ?? false,
  blockedAt: user.blockedAt || null,
  blockedBy: user.blockedBy || null,
  blockReason: user.blockReason || null,
  sessions: Array.isArray(user.sessions) ? user.sessions : [],
});

const buildBranchFilter = (branchId?: string) => {
  if (!branchId) return {};

  try {
    return {
      branchId: new mongoose.Types.ObjectId(branchId),
    };
  } catch {
    return { branchId };
  }
};

const matchesValue = (value: unknown, target?: string) => {
  if (!target) return false;
  return toStringId(value) === target;
};

const isUserInScope = (user: any, currentUserRole?: string, currentBranchId?: string, currentTenantId?: string | null) => {
  const userRole = (user.role || "").toUpperCase();
  const currentRole = (currentUserRole || "").toUpperCase();
  const userTenant = toStringId(user.tenantId);
  const currentTenant = toStringId(currentTenantId);

  if (currentRole === "RETAILER") {
    // Retailer should only see their own staff:
    // Exclude Manufacturer roles (ADMIN, KARIKAR) and RETAILER itself
    if (userRole === "ADMIN" || userRole === "KARIKAR" || userRole === "RETAILER") {
      return false;
    }
    if (currentTenant === "default-shop" || !currentTenant) {
      return userTenant === "default-shop" || !userTenant;
    }
    return userTenant === currentTenant;
  }

  if (currentRole === "ADMIN") {
    // Manufacturer (ADMIN) should only see manufacturer's users:
    // Exclude Retailer users
    if (userRole === "RETAILER") {
      return false;
    }
    if (currentTenant === "default-shop") {
      return userTenant === "default-shop" || !userTenant;
    }
    if (currentTenant) {
      return userTenant === currentTenant || toStringId(user.branchId) === currentTenant;
    }
    return !userTenant || userTenant === "default-shop";
  }

  if (userRole === "ADMIN" || userRole === "RETAILER") {
    return false;
  }

  if (currentUserRole === "STORE_MANAGER") {
    return matchesValue(user.branchId, currentBranchId);
  }

  return true;
};

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role, phone, branchId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const dbReady = mongoose.connection.readyState === 1;
    let existingUser = null;
    const UserModel = getUserModel(req);

    if (dbReady) {
      existingUser = await UserModel.findOne({ email });
    } else {
      const allUsers = await getAllFallbackUsers();
      existingUser = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    }

    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Set tenantId from logged-in user to maintain isolation
    const tenantId = req.user?.tenantId || null;

    if (dbReady) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new UserModel({
        name,
        email,
        password: hashedPassword,
        role: role || "CUSTOMER",
        phone,
        branchId: branchId || null,
        tenantId,
        oauthProvider: "JWT"
      });
      await user.save();

      return res.status(201).json({
        success: true,
        data: normalizeUser(user.toObject())
      });
    }

    const newUser = {
      _id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name,
      email,
      password,
      role: role || "CUSTOMER",
      phone,
      branchId: branchId || null,
      tenantId: tenantId || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await addFallbackUser(newUser);

    return res.status(201).json({
      success: true,
      data: normalizeUser(newUser)
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to create user" });
  }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const dbReady = mongoose.connection.readyState === 1;
    const currentUserRole = req.user?.role;
    const currentBranchId = req.user?.branchId;
    const currentTenantId = req.user?.tenantId;

    if (dbReady) {
      const query: any = {};
      if (currentUserRole === "STORE_MANAGER" && currentBranchId) {
        query.branchId = buildBranchFilter(currentBranchId).branchId;
      }

      // Limit search space by tenantId to prevent scanning other tenants' users
      if (currentTenantId && currentTenantId !== "default-shop") {
        query.tenantId = currentTenantId;
      } else if (currentTenantId === "default-shop") {
        query.tenantId = { $in: ["default-shop", null] };
      }

      const UserModel = getUserModel(req);
      const users = await UserModel.find(query)
        .sort({ createdAt: -1 })
        .lean();

      const scopedUsers = users.filter((user) => isUserInScope(user, currentUserRole, currentBranchId, currentTenantId));

      return res.json({
        success: true,
        data: scopedUsers.map(normalizeUser),
      });
    }

    const fallbackUsers = await getAllFallbackUsers();
    const filtered = fallbackUsers.filter((user) => isUserInScope(user, currentUserRole, currentBranchId, currentTenantId));

    return res.json({
      success: true,
      data: filtered.map(normalizeUser),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch users" });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "User ID is required" });

    const dbReady = mongoose.connection.readyState === 1;

    if (dbReady) {
      const UserModel = getUserModel(req);
      const user = await UserModel.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      if ((user as any).role === "ADMIN") {
        return res.status(403).json({ error: "Cannot delete an Admin account" });
      }
      await UserModel.deleteOne({ _id: id });
    } else {
      const deleted = await deleteFallbackUser(id);
      if (!deleted) return res.status(404).json({ error: "User not found" });
    }

    return res.json({ success: true, message: "User access revoked successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to delete user" });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    if (!id) {
      return res.status(400).json({ error: "User id is required" });
    }

    const dbReady = mongoose.connection.readyState === 1;

    if (dbReady) {
      const UserModel = getUserModel(req);
      const user = await UserModel.findById(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!isUserInScope(user, req.user?.role, req.user?.branchId, req.user?.tenantId)) {
        return res.status(403).json({ error: "Forbidden: User is out of your management scope." });
      }

      if ((user.role || "").toUpperCase() === "ADMIN") {
        return res.status(403).json({ error: "Admin account is read-only and cannot be modified." });
      }

      const allowedFields = ["name", "email", "phone", "status", "role", "branchId", "permissions", "shiftSchedule", "salesTarget", "commissionRate"];
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          if (field === "status" && !ALLOWED_STATUSES.includes(updates[field])) {
            return res.status(400).json({ error: "Invalid status value" });
          }
          if (field === "role") {
            if (!ALLOWED_ROLES.includes(updates[field])) {
              return res.status(400).json({ error: "Invalid role value" });
            }
            if ((updates[field] || "").toUpperCase() === "ADMIN") {
              return res.status(403).json({ error: "Only one admin is allowed per shop" });
            }
          }
          user[field] = updates[field];
        }
      }

      user.updatedAt = new Date();
      await user.save();

      return res.json({
        success: true,
        data: normalizeUser(user.toObject()),
      });
    }

    const fallbackUser = await findFallbackUserById(id);
    if (!fallbackUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!isUserInScope(fallbackUser, req.user?.role, req.user?.branchId, req.user?.tenantId)) {
      return res.status(403).json({ error: "Forbidden: User is out of your management scope." });
    }

    if ((fallbackUser.role || "").toUpperCase() === "ADMIN") {
      return res.status(403).json({ error: "Admin account is read-only and cannot be modified." });
    }

    const updatedUser = {
      ...fallbackUser,
      name: updates.name ?? fallbackUser.name,
      email: updates.email ?? fallbackUser.email,
      phone: updates.phone ?? fallbackUser.phone,
      status: updates.status ?? fallbackUser.status ?? "ACTIVE",
      role: updates.role ?? fallbackUser.role,
      branchId: updates.branchId ?? fallbackUser.branchId ?? null,
      permissions: updates.permissions ?? fallbackUser.permissions ?? [],
      shiftSchedule: updates.shiftSchedule ?? fallbackUser.shiftSchedule,
      salesTarget: updates.salesTarget ?? fallbackUser.salesTarget ?? 100000,
      commissionRate: updates.commissionRate ?? fallbackUser.commissionRate ?? 1.0,
      updatedAt: new Date().toISOString(),
    };

    if (updates.status && !ALLOWED_STATUSES.includes(updates.status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    if (updates.role && !ALLOWED_ROLES.includes(updates.role)) {
      return res.status(400).json({ error: "Invalid role value" });
    }

    await updateFallbackUser(updatedUser);

    return res.json({
      success: true,
      data: normalizeUser(updatedUser),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to update user" });
  }
};

export const clockShift = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { type, timestamp } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: "User id is required" });
    }

    if (req.user?.id !== id) {
      return res.status(403).json({ error: "You can only clock your own shift" });
    }

    if (!type || !["clock-in", "clock-out"].includes(type)) {
      return res.status(400).json({ error: "Shift type must be clock-in or clock-out" });
    }

    const shiftTimestamp = timestamp ? new Date(timestamp) : new Date();
    if (Number.isNaN(shiftTimestamp.getTime())) {
      return res.status(400).json({ error: "Invalid timestamp format" });
    }

    const dbReady = mongoose.connection.readyState === 1;

    if (dbReady) {
      const UserModel = getUserModel(req);
      const user = await UserModel.findById(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      user.shiftHistory = Array.isArray(user.shiftHistory) ? user.shiftHistory : [];
      user.shiftHistory.push({
        type,
        timestamp: shiftTimestamp,
      });
      user.updatedAt = new Date();
      await user.save();

      return res.json({
        success: true,
        data: normalizeUser(user.toObject()),
      });
    }

    const fallbackUser = await findFallbackUserById(id);
    if (!fallbackUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser = {
      ...fallbackUser,
      shiftHistory: Array.isArray(fallbackUser.shiftHistory) ? [...fallbackUser.shiftHistory, { type, timestamp: shiftTimestamp.toISOString() }] : [{ type, timestamp: shiftTimestamp.toISOString() }],
      updatedAt: new Date().toISOString(),
    };

    await updateFallbackUser(updatedUser);

    return res.json({
      success: true,
      data: normalizeUser(updatedUser),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to clock shift" });
  }
};

export const getAllAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();
    let users = [];

    if (dbReady) {
      const UserModel = getUserModel(req);
      users = await UserModel.find({ role: { $ne: "SUPER_ADMIN" } }).lean();
    } else {
      users = await getAllFallbackUsers();
    }

    const currentUserRole = req.user?.role;
    const currentBranchId = req.user?.branchId;
    const currentTenantId = req.user?.tenantId;

    const scopedUsers = users.filter((u: any) => isUserInScope(u, currentUserRole, currentBranchId, currentTenantId));

    const attendanceLogs: any[] = [];
    scopedUsers.forEach((user: any) => {
      const history = Array.isArray(user.shiftHistory) ? user.shiftHistory : [];
      history.forEach((log: any) => {
        attendanceLogs.push({
          userId: user._id?.toString() || user.id || "",
          userName: user.name,
          role: user.role,
          type: log.type,
          timestamp: log.timestamp
        });
      });
    });

    // Sort by timestamp descending
    attendanceLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json({
      success: true,
      data: attendanceLogs
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch attendance logs" });
  }
};

export const getStaffPerformance = async (req: AuthRequest, res: Response) => {
  try {
    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();
    let staff = [];
    let sales = [];

    if (dbReady) {
      const UserModel = getUserModel(req);
      const SaleModel = getSaleModel(req);
      staff = await UserModel.find({ role: { $in: ["SALES_STAFF", "SALES", "STORE_MANAGER", "ACCOUNTANT"] } }).lean();
      sales = await SaleModel.find({ status: { $ne: "cancelled" } }).lean();
    } else {
      const allUsers = await getAllFallbackUsers();
      staff = allUsers.filter((u: any) => ["SALES_STAFF", "SALES", "STORE_MANAGER", "ACCOUNTANT"].includes(u.role));
      sales = mockSales || [];
    }

    const currentUserRole = req.user?.role;
    const currentBranchId = req.user?.branchId;
    const currentTenantId = req.user?.tenantId;

    const scopedStaff = staff.filter((u: any) => isUserInScope(u, currentUserRole, currentBranchId, currentTenantId));

    const performanceReport = scopedStaff.map((member: any) => {
      const id = member._id?.toString() || member.id || "";
      // Filter sales attributed to this staff member
      const memberSales = sales.filter((sale: any) => {
        const saleStaffId = sale.staffId?.toString() || "";
        return saleStaffId === id || (sale.staffName && sale.staffName.toLowerCase() === member.name.toLowerCase());
      });

      const totalSales = memberSales.reduce((sum: number, sale: any) => sum + (sale.total || 0), 0);
      const transactionsCount = memberSales.length;
      const averageSaleValue = transactionsCount > 0 ? totalSales / transactionsCount : 0;

      const salesTarget = member.salesTarget ?? 100000;
      const commissionRate = member.commissionRate ?? 1.0;
      const commissionEarned = (totalSales * commissionRate) / 100;
      const targetAchievement = salesTarget > 0 ? (totalSales / salesTarget) * 100 : 0;

      return {
        userId: id,
        userName: member.name,
        email: member.email,
        role: member.role,
        salesTarget,
        commissionRate,
        totalSales,
        transactionsCount,
        averageSaleValue,
        commissionEarned,
        targetAchievement: Math.min(targetAchievement, 100) // cap visual completion, but calculate actual
      };
    });

    return res.json({
      success: true,
      data: performanceReport
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to calculate performance metrics" });
  }
};

export const getUserSchedule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const authReq = req as AuthRequest;

    const dbReady = mongoose.connection.readyState === 1;
    let targetUser: any = null;
    const UserModel = getUserModel(authReq);
    if (dbReady) {
      targetUser = await UserModel.findById(id);
    } else {
      targetUser = await findFallbackUserById(id);
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (!isUserInScope(targetUser, authReq.user?.role, authReq.user?.branchId, authReq.user?.tenantId)) {
      return res.status(403).json({ success: false, error: "Forbidden: User is out of your management scope." });
    }

    if (dbReady) {
      const ShiftScheduleModel = getShiftScheduleModel(authReq);
      const schedule = await ShiftScheduleModel.findOne({ userId: id }).lean();
      return res.json({ success: true, data: schedule });
    } else {
      const list = await getAllFallbackSchedules();
      const schedule = list.find((s: any) => s.userId === id);
      return res.json({ success: true, data: schedule || null });
    }
  } catch (error: any) {
    console.error("Failed to load shift schedule", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to load shift schedule" });
  }
};

export const updateUserSchedule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { days, timeStart, timeEnd, shiftName, userName } = req.body;

    if (!timeStart || !timeEnd) {
      return res.status(400).json({ success: false, error: "timeStart and timeEnd are required" });
    }

    const authReq = req as AuthRequest;

    const dbReady = mongoose.connection.readyState === 1;
    let targetUser: any = null;
    const UserModel = getUserModel(authReq);
    if (dbReady) {
      targetUser = await UserModel.findById(id);
    } else {
      targetUser = await findFallbackUserById(id);
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (!isUserInScope(targetUser, authReq.user?.role, authReq.user?.branchId, authReq.user?.tenantId)) {
      return res.status(403).json({ success: false, error: "Forbidden: User is out of your management scope." });
    }

    const payload = {
      userId: id,
      userName: userName || "Staff",
      days: days || [],
      timeStart,
      timeEnd,
      shiftName: shiftName || "General Shift",
      updatedAt: new Date().toISOString()
    };

    if (dbReady) {
      if ((targetUser.role || "").toUpperCase() === "ADMIN") {
        return res.status(403).json({ success: false, error: "Admin schedule cannot be modified." });
      }

      const UserModel = getUserModel(authReq);
      const ShiftScheduleModel = getShiftScheduleModel(authReq);

      await UserModel.findByIdAndUpdate(id, {
        $set: {
          shiftSchedule: {
            days: days || [],
            timeStart,
            timeEnd,
            shiftName: shiftName || "General Shift"
          }
        }
      });

      const updated = await ShiftScheduleModel.findOneAndUpdate(
        { userId: id },
        { $set: payload },
        { upsert: true, new: true }
      );
      return res.json({ success: true, data: updated });
    } else {
      if ((targetUser.role || "").toUpperCase() === "ADMIN") {
        return res.status(403).json({ success: false, error: "Admin schedule cannot be modified." });
      }

      targetUser.shiftSchedule = {
        days: days || [],
        timeStart,
        timeEnd,
        shiftName: shiftName || "General Shift"
      };
      await updateFallbackUser(targetUser);

      const list = await getAllFallbackSchedules();
      const existing = list.find((s: any) => s.userId === id);
      const schedulePayload = {
        ...payload,
        _id: existing?._id || `SCH-${Date.now()}`
      };
      await updateFallbackSchedule(schedulePayload);
      return res.json({ success: true, data: schedulePayload });
    }
  } catch (error: any) {
    console.error("Failed to update shift schedule", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to update shift schedule" });
  }
};

// Administrative User Actions
export const blockUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (req.user?.id === id) {
      return res.status(400).json({ error: "You cannot block yourself." });
    }

    const dbReady = mongoose.connection.readyState === 1;
    let user: any = null;
    if (dbReady) {
      const UserModel = getUserModel(req);
      user = await UserModel.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (user.role === "SUPER_ADMIN" && user.status === "ACTIVE") {
        const saCount = await UserModel.countDocuments({ role: "SUPER_ADMIN", status: "ACTIVE" });
        if (saCount <= 1) {
          return res.status(400).json({ error: "Cannot block the last active Super Admin." });
        }
      }
    } else {
      user = await findFallbackUserById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const all = await getAllFallbackUsers();
      const saCount = all.filter((u: any) => u.role === "SUPER_ADMIN" && (u.status === "ACTIVE" || !u.status)).length;
      if (user.role === "SUPER_ADMIN" && saCount <= 1 && user.status !== "BLOCKED") {
        return res.status(400).json({ error: "Cannot block the last active Super Admin." });
      }
    }

    if (user.status === "BLOCKED") {
      return res.status(400).json({ error: "User is already blocked." });
    }

    user.status = "BLOCKED";
    user.blockedAt = new Date();
    user.blockedBy = req.user?.email || "Admin";
    user.blockReason = reason || "Administrative action";
    user.sessions = []; // Terminate all sessions

    if (dbReady) {
      await user.save();
      
      // Log Action
      const log = new UserActionLog({
        targetUserId: user._id.toString(),
        targetUserEmail: user.email,
        adminId: req.user?.id || "System",
        adminEmail: req.user?.email || "system@aurajewel.com",
        action: "BLOCK",
        reason: reason || "Administrative action"
      });
      await log.save();

      // Create Notification
      const notif = new Notification({
        notificationId: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: "USER_BLOCKED",
        title: "User Blocked",
        message: `User ${user.email} has been blocked by ${req.user?.email || "Admin"}.`,
        severity: "WARNING",
        category: "Security",
        status: "SENT",
        recipientEmails: [user.email],
        metadata: { targetUserId: user._id.toString(), adminId: req.user?.id }
      });
      await notif.save();
    } else {
      await updateFallbackUser(user);
    }

    return res.json({ success: true, message: "User blocked successfully", data: normalizeUser(user) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to block user" });
  }
};

export const activateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const dbReady = mongoose.connection.readyState === 1;
    let user: any = null;
    if (dbReady) {
      const UserModel = getUserModel(req);
      user = await UserModel.findById(id);
    } else {
      user = await findFallbackUserById(id);
    }

    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.status === "ACTIVE") {
      return res.status(400).json({ error: "User is already active." });
    }

    user.status = "ACTIVE";
    user.blockedAt = undefined;
    user.blockedBy = undefined;
    user.blockReason = undefined;

    if (dbReady) {
      await user.save();

      // Log Action
      const log = new UserActionLog({
        targetUserId: user._id.toString(),
        targetUserEmail: user.email,
        adminId: req.user?.id || "System",
        adminEmail: req.user?.email || "system@aurajewel.com",
        action: "ACTIVATE",
        reason: "User activated by Administrator"
      });
      await log.save();

      // Create Notification
      const notif = new Notification({
        notificationId: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: "USER_ACTIVATED",
        title: "User Activated",
        message: `User ${user.email} has been activated by ${req.user?.email || "Admin"}.`,
        severity: "INFO",
        category: "Security",
        status: "SENT",
        recipientEmails: [user.email],
        metadata: { targetUserId: user._id.toString(), adminId: req.user?.id }
      });
      await notif.save();
    } else {
      await updateFallbackUser(user);
    }

    return res.json({ success: true, message: "User activated successfully", data: normalizeUser(user) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to activate user" });
  }
};

export const deactivateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (req.user?.id === id) {
      return res.status(400).json({ error: "You cannot deactivate yourself." });
    }

    const dbReady = mongoose.connection.readyState === 1;
    let user: any = null;
    if (dbReady) {
      const UserModel = getUserModel(req);
      user = await UserModel.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (user.role === "SUPER_ADMIN" && user.status === "ACTIVE") {
        const saCount = await UserModel.countDocuments({ role: "SUPER_ADMIN", status: "ACTIVE" });
        if (saCount <= 1) {
          return res.status(400).json({ error: "Cannot deactivate the last active Super Admin." });
        }
      }
    } else {
      user = await findFallbackUserById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const all = await getAllFallbackUsers();
      const saCount = all.filter((u: any) => u.role === "SUPER_ADMIN" && (u.status === "ACTIVE" || !u.status)).length;
      if (user.role === "SUPER_ADMIN" && saCount <= 1 && user.status !== "INACTIVE") {
        return res.status(400).json({ error: "Cannot deactivate the last active Super Admin." });
      }
    }

    if (user.status === "INACTIVE") {
      return res.status(400).json({ error: "User is already inactive." });
    }

    user.status = "INACTIVE";
    user.sessions = []; // Terminate all sessions

    if (dbReady) {
      await user.save();

      // Log Action
      const log = new UserActionLog({
        targetUserId: user._id.toString(),
        targetUserEmail: user.email,
        adminId: req.user?.id || "System",
        adminEmail: req.user?.email || "system@aurajewel.com",
        action: "DEACTIVATE",
        reason: reason || "Deactivated by Administrator"
      });
      await log.save();

      // Create Notification
      const notif = new Notification({
        notificationId: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: "USER_DEACTIVATED",
        title: "User Deactivated",
        message: `User ${user.email} has been deactivated by ${req.user?.email || "Admin"}.`,
        severity: "INFO",
        category: "Security",
        status: "SENT",
        recipientEmails: [user.email],
        metadata: { targetUserId: user._id.toString(), adminId: req.user?.id }
      });
      await notif.save();
    } else {
      await updateFallbackUser(user);
    }

    return res.json({ success: true, message: "User deactivated successfully", data: normalizeUser(user) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to deactivate user" });
  }
};

export const forcePasswordReset = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?.id === id) {
      return res.status(400).json({ error: "You cannot force password reset on yourself." });
    }

    const dbReady = mongoose.connection.readyState === 1;
    let user: any = null;
    if (dbReady) {
      const UserModel = getUserModel(req);
      user = await UserModel.findById(id);
    } else {
      user = await findFallbackUserById(id);
    }

    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.passwordResetRequired) {
      return res.status(400).json({ error: "Password reset is already forced for this user." });
    }

    user.passwordResetRequired = true;
    user.sessions = []; // Terminate all sessions

    if (dbReady) {
      await user.save();

      // Log Action
      const log = new UserActionLog({
        targetUserId: user._id.toString(),
        targetUserEmail: user.email,
        adminId: req.user?.id || "System",
        adminEmail: req.user?.email || "system@aurajewel.com",
        action: "FORCE_PASSWORD_RESET",
        reason: "Forced password reset by Administrator"
      });
      await log.save();

      // Create Notification
      const notif = new Notification({
        notificationId: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: "PASSWORD_RESET_FORCED",
        title: "Password Reset Forced",
        message: `A password reset has been forced on your account by ${req.user?.email || "Admin"}. Please change your password on next login.`,
        severity: "WARNING",
        category: "Security",
        status: "SENT",
        recipientEmails: [user.email],
        metadata: { targetUserId: user._id.toString(), adminId: req.user?.id }
      });
      await notif.save();
    } else {
      await updateFallbackUser(user);
    }

    return res.json({ success: true, message: "Password reset forced successfully", data: normalizeUser(user) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to force password reset" });
  }
};

export const logoutAllSessions = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const dbReady = mongoose.connection.readyState === 1;
    let user: any = null;
    if (dbReady) {
      const UserModel = getUserModel(req);
      user = await UserModel.findById(id);
    } else {
      user = await findFallbackUserById(id);
    }

    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.sessions || user.sessions.length === 0) {
      return res.status(400).json({ error: "User has no active sessions." });
    }

    user.sessions = [];

    if (dbReady) {
      await user.save();

      // Log Action
      const log = new UserActionLog({
        targetUserId: user._id.toString(),
        targetUserEmail: user.email,
        adminId: req.user?.id || "System",
        adminEmail: req.user?.email || "system@aurajewel.com",
        action: "LOGOUT_ALL_SESSIONS",
        reason: "All sessions logged out by Administrator"
      });
      await log.save();
    } else {
      await updateFallbackUser(user);
    }

    return res.json({ success: true, message: "All user sessions terminated successfully", data: normalizeUser(user) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to logout all sessions" });
  }
};

export const getUserActionsHistory = async (req: AuthRequest, res: Response) => {
  try {
    const dbReady = mongoose.connection.readyState === 1;
    if (dbReady) {
      const logs = await UserActionLog.find().sort({ timestamp: -1 }).limit(100).lean();
      return res.json({ success: true, data: logs });
    }
    return res.json({ success: true, data: [] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch user actions history" });
  }
};


