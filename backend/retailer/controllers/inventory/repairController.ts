import { Response } from "express";
import mongoose from "mongoose";
import { RepairJob } from "../../models/index.js";
import { AuthRequest } from "../../../lib/authUtils.js";
import { isDbConnected } from "../../../lib/serverState.js";
import {
  getAllFallbackRepairJobs,
  addFallbackRepairJob,
  updateFallbackRepairJob,
  findFallbackRepairJobById,
} from "../../../lib/fallbackStore.js";

// Normalize RepairJob objects for standard response
const normalizeRepairJob = (job: any) => ({
  id: job._id?.toString() || job.id || job._id || "",
  repairJobId: job.repairJobId || "",
  customerName: job.customerName || "",
  customerPhone: job.customerPhone || "",
  itemDescription: job.itemDescription || "",
  estimatedWeight: job.estimatedWeight || 0,
  issueDate: job.issueDate,
  dueDate: job.dueDate || null,
  repairCost: job.repairCost || 0,
  status: job.status || "Received",
  karikarId: job.karikarId || "",
  notes: job.notes || "",
  tenantId: job.tenantId || "default-shop",
  createdAt: job.createdAt,
  updatedAt: job.updatedAt
});

export const getRepairJobs = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();

    if (dbReady) {
      const jobs = await RepairJob.find({ tenantId }).sort({ createdAt: -1 });
      return res.json({
        success: true,
        data: jobs.map(normalizeRepairJob)
      });
    }

    const fallbackJobs = await getAllFallbackRepairJobs();
    const shopJobs = fallbackJobs.filter(j => j.tenantId === tenantId);
    return res.json({
      success: true,
      data: shopJobs.map(normalizeRepairJob)
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch repair jobs" });
  }
};

export const createRepairJob = async (req: AuthRequest, res: Response) => {
  try {
    const { customerName, customerPhone, itemDescription, estimatedWeight, dueDate, repairCost, karikarId, notes } = req.body || {};
    const tenantId = req.user?.tenantId || "default-shop";

    if (!customerName || !customerPhone || !itemDescription) {
      return res.status(400).json({ error: "Customer name, phone, and item description are required" });
    }

    const repairJobId = `REP-${Date.now()}`;
    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();

    if (dbReady) {
      const newJob = new RepairJob({
        repairJobId,
        customerName,
        customerPhone,
        itemDescription,
        estimatedWeight: parseFloat(estimatedWeight || 0),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        repairCost: parseFloat(repairCost || 0),
        status: "Received",
        karikarId,
        notes,
        tenantId
      });
      await newJob.save();
      return res.status(201).json({
        success: true,
        data: normalizeRepairJob(newJob.toObject())
      });
    }

    const newFallbackJob = {
      _id: `repair-${Date.now()}`,
      repairJobId,
      customerName,
      customerPhone,
      itemDescription,
      estimatedWeight: parseFloat(estimatedWeight || 0),
      issueDate: new Date().toISOString(),
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      repairCost: parseFloat(repairCost || 0),
      status: "Received",
      karikarId,
      notes,
      tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await addFallbackRepairJob(newFallbackJob);
    return res.status(201).json({
      success: true,
      data: normalizeRepairJob(newFallbackJob)
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to create repair job" });
  }
};

export const updateRepairJob = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, karikarId, estimatedWeight, repairCost, notes, dueDate } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: "Repair Job ID is required" });
    }

    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();

    if (dbReady) {
      const job = await RepairJob.findById(id);
      if (!job) {
        return res.status(404).json({ error: "Repair job not found" });
      }

      if (status !== undefined) job.status = status;
      if (karikarId !== undefined) job.karikarId = karikarId;
      if (estimatedWeight !== undefined) job.estimatedWeight = parseFloat(estimatedWeight || 0);
      if (repairCost !== undefined) job.repairCost = parseFloat(repairCost || 0);
      if (notes !== undefined) job.notes = notes;
      if (dueDate !== undefined) job.dueDate = dueDate ? new Date(dueDate) : undefined;
      job.updatedAt = new Date();

      await job.save();
      return res.json({
        success: true,
        data: normalizeRepairJob(job.toObject())
      });
    }

    const job = await findFallbackRepairJobById(id);
    if (!job) {
      return res.status(404).json({ error: "Repair job not found" });
    }

    const updatedJob = {
      ...job,
      status: status !== undefined ? status : job.status,
      karikarId: karikarId !== undefined ? karikarId : job.karikarId,
      estimatedWeight: estimatedWeight !== undefined ? parseFloat(estimatedWeight || 0) : job.estimatedWeight,
      repairCost: repairCost !== undefined ? parseFloat(repairCost || 0) : job.repairCost,
      notes: notes !== undefined ? notes : job.notes,
      dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate).toISOString() : undefined) : job.dueDate,
      updatedAt: new Date().toISOString()
    };

    await updateFallbackRepairJob(updatedJob);
    return res.json({
      success: true,
      data: normalizeRepairJob(updatedJob)
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to update repair job" });
  }
};


