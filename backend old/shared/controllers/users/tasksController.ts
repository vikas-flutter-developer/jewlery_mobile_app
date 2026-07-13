import { Response } from "express";
import mongoose from "mongoose";
import { Task as DefaultTask } from "../../../models/index.js";
import { Task as RetailerTask } from "../../../retailer/models/index.js";
import { ManufacturerTask } from "../../../manufacturer/models/index.js";
import { AuthRequest } from "../../../lib/authUtils.js";
import { isDbConnected } from "../../../lib/serverState.js";
import {
  getAllFallbackTasks,
  addFallbackTask,
  updateFallbackTask,
  findFallbackTaskById,
} from "../../../lib/fallbackStore.js";

const getStoreType = (req: any) => {
  if (req.user?.storeType) return req.user.storeType;
  const role = req.user?.role;
  if (role === "RETAILER") return "RETAILER";
  if (role === "ADMIN") return "MANUFACTURER";
  return "RETAILER"; // fallback
};

const getTaskModel = (req: any) => {
  const storeType = getStoreType(req);
  if (storeType === "RETAILER") return RetailerTask;
  if (storeType === "MANUFACTURER") return ManufacturerTask;
  return DefaultTask;
};

// Normalize Task objects for standard API response
const normalizeTask = (task: any) => ({
  id: task._id?.toString() || task.id || task._id || "",
  title: task.title || "",
  description: task.description || "",
  status: task.status || "pending",
  assignedTo: task.assignedTo || "",
  createdBy: task.createdBy || "",
  tenantId: task.tenantId || "",
  dueDate: task.dueDate || "",
  deadline: task.deadline || "",
  comments: Array.isArray(task.comments) ? task.comments.map((c: any) => ({
    text: c.text,
    createdBy: c.createdBy,
    createdByName: c.createdByName || "Staff",
    createdAt: c.createdAt
  })) : [],
  createdAt: task.createdAt,
  updatedAt: task.updatedAt
});

export const getTasks = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();

    if (dbReady) {
      const TaskModel = getTaskModel(req);
      const tasks = await TaskModel.find({ tenantId }).sort({ createdAt: -1 });
      return res.json({
        success: true,
        data: tasks.map(normalizeTask)
      });
    }

    const fallbackTasks = await getAllFallbackTasks();
    const shopTasks = fallbackTasks.filter(t => t.tenantId === tenantId);
    return res.json({
      success: true,
      data: shopTasks.map(normalizeTask)
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch tasks" });
  }
};

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, assignedTo, dueDate, deadline } = req.body || {};
    const createdBy = req.user?.id || "admin-fallback";
    const tenantId = req.user?.tenantId || "default-shop";

    if (!title) {
      return res.status(400).json({ error: "Task title is required" });
    }

    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();

    if (dbReady) {
      const TaskModel = getTaskModel(req);
      const newTask = new TaskModel({
        title,
        description,
        status: "pending",
        assignedTo,
        createdBy,
        tenantId,
        dueDate,
        deadline,
        comments: []
      });
      await newTask.save();
      return res.status(201).json({
        success: true,
        data: normalizeTask(newTask.toObject())
      });
    }

    const newFallbackTask = {
      _id: `task-${Date.now()}`,
      title,
      description,
      status: "pending",
      assignedTo,
      createdBy,
      tenantId,
      dueDate,
      deadline,
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await addFallbackTask(newFallbackTask);
    return res.status(201).json({
      success: true,
      data: normalizeTask(newFallbackTask)
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to create task" });
  }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, status, assignedTo, dueDate, deadline } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: "Task ID is required" });
    }

    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();

    if (dbReady) {
      const TaskModel = getTaskModel(req);
      const task = await TaskModel.findById(id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (status !== undefined) task.status = status;
      if (assignedTo !== undefined) task.assignedTo = assignedTo;
      if (dueDate !== undefined) task.dueDate = dueDate;
      if (deadline !== undefined) task.deadline = deadline;
      task.updatedAt = new Date();

      await task.save();
      return res.json({
        success: true,
        data: normalizeTask(task.toObject())
      });
    }

    const task = await findFallbackTaskById(id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const updatedTask = {
      ...task,
      title: title !== undefined ? title : task.title,
      description: description !== undefined ? description : task.description,
      status: status !== undefined ? status : task.status,
      assignedTo: assignedTo !== undefined ? assignedTo : task.assignedTo,
      dueDate: dueDate !== undefined ? dueDate : task.dueDate,
      deadline: deadline !== undefined ? deadline : task.deadline,
      updatedAt: new Date().toISOString()
    };

    await updateFallbackTask(updatedTask);
    return res.json({
      success: true,
      data: normalizeTask(updatedTask)
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to update task" });
  }
};

export const addTaskComment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { text } = req.body || {};
    const createdBy = req.user?.id || "admin-fallback";
    const createdByName = req.user?.email ? req.user.email.split('@')[0] : "Staff";

    if (!id) {
      return res.status(400).json({ error: "Task ID is required" });
    }
    if (!text) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();

    if (dbReady) {
      const TaskModel = getTaskModel(req);
      const task = await TaskModel.findById(id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      task.comments.push({
        text,
        createdBy,
        createdByName,
        createdAt: new Date()
      });
      task.updatedAt = new Date();

      await task.save();
      return res.json({
        success: true,
        data: normalizeTask(task.toObject())
      });
    }

    const task = await findFallbackTaskById(id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const newComment = {
      text,
      createdBy,
      createdByName,
      createdAt: new Date().toISOString()
    };

    const updatedTask = {
      ...task,
      comments: [...task.comments, newComment],
      updatedAt: new Date().toISOString()
    };

    await updateFallbackTask(updatedTask);
    return res.json({
      success: true,
      data: normalizeTask(updatedTask)
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to add comment" });
  }
};


