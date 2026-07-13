import { Request, Response } from "express";
import { mockTransfers } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";

interface BranchTransferItem {
  sku: string;
  name: string;
  quantity: number;
  unit?: string;
}

interface BranchTransferRecord {
  transferId: string;
  fromBranchCode: string;
  toBranchCode: string;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "RECEIVED";
  items: BranchTransferItem[];
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  receivedAt?: string;
  receivedBy?: string;
  notes?: string;
}

const normalizeBranchCode = (value: unknown) => String(value || "").trim().toUpperCase();

const normalizeText = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const toPositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const generateTransferId = () => `TRF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const parseItems = (body: Record<string, any>) => {
  const rawItems = Array.isArray(body.items) ? body.items : body.item ? [body.item] : [];

  if (!rawItems.length) {
    throw new Error("items are required");
  }

  return rawItems.map((item: any, index: number) => {
    if (!item || typeof item !== "object") {
      throw new Error(`items[${index}] must be an object`);
    }

    const sku = normalizeText(item.sku || body.sku, "SKU-UNKNOWN");
    const name = normalizeText(item.name || body.name || sku, "Unnamed Item");
    const quantity = toPositiveNumber(item.quantity ?? body.quantity, 1);

    return {
      sku,
      name,
      quantity,
      unit: normalizeText(item.unit || body.unit, "units"),
    };
  });
};

export const getBranchTransfers = async (req: Request, res: Response) => {
  try {
    // Return all transfers
    return res.json({
      success: true,
      data: mockTransfers
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch transfers"
    });
  }
};

export const createBranchTransfer = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, any>;
    const fromBranchCode = normalizeBranchCode(body.fromBranchCode || body.fromBranch || body.sourceBranchCode);
    const toBranchCode = normalizeBranchCode(body.toBranchCode || body.toBranch || body.destinationBranchCode);

    if (!fromBranchCode || !toBranchCode) {
      return res.status(400).json({
        success: false,
        error: "fromBranchCode and toBranchCode are required",
      });
    }

    if (fromBranchCode === toBranchCode) {
      return res.status(400).json({
        success: false,
        error: "fromBranchCode and toBranchCode must be different",
      });
    }

    const items = parseItems(body);
    const transfer: BranchTransferRecord = {
      transferId: generateTransferId(),
      fromBranchCode,
      toBranchCode,
      status: "PENDING_APPROVAL",
      items,
      createdAt: new Date().toISOString(),
      notes: normalizeText(body.notes),
    };

    mockTransfers.push(transfer);

    return res.status(201).json({
      success: true,
      message: "Branch transfer request created and is pending approval",
      data: transfer,
    });
  } catch (error: any) {
    const statusCode = error.message?.includes("required") || error.message?.includes("must") ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || "Failed to create branch transfer",
    });
  }
};

export const approveBranchTransfer = async (req: Request, res: Response) => {
  try {
    const { transferId } = req.params;
    const transfer = mockTransfers.find((record) => record.transferId === transferId);

    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: "Branch transfer not found",
      });
    }

    if (transfer.status !== "PENDING_APPROVAL") {
      return res.status(400).json({
        success: false,
        error: `Cannot approve transfer in status: ${transfer.status}`,
      });
    }

    transfer.status = "APPROVED";
    transfer.approvedAt = new Date().toISOString();

    return res.json({
      success: true,
      message: "Branch transfer has been approved & dispatched",
      data: transfer,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to approve branch transfer",
    });
  }
};

export const rejectBranchTransfer = async (req: Request, res: Response) => {
  try {
    const { transferId } = req.params;
    const transfer = mockTransfers.find((record) => record.transferId === transferId);

    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: "Branch transfer not found",
      });
    }

    if (transfer.status !== "PENDING_APPROVAL") {
      return res.status(400).json({
        success: false,
        error: `Cannot reject transfer in status: ${transfer.status}`,
      });
    }

    transfer.status = "REJECTED";
    transfer.rejectedAt = new Date().toISOString();

    return res.json({
      success: true,
      message: "Branch transfer has been rejected",
      data: transfer,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to reject branch transfer",
    });
  }
};

export const receiveBranchTransfer = async (req: Request, res: Response) => {
  try {
    const { transferId } = req.params;
    const transfer = mockTransfers.find((record) => record.transferId === transferId);

    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: "Branch transfer not found",
      });
    }

    if (transfer.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        error: `Cannot mark transfer as received. Status is: ${transfer.status} (Must be APPROVED)`,
      });
    }

    transfer.status = "RECEIVED";
    transfer.receivedAt = new Date().toISOString();
    transfer.receivedBy = normalizeText(req.body?.receivedBy || req.body?.acknowledgedBy, "system manager");

    return res.json({
      success: true,
      message: "Branch transfer acknowledged & stock merged",
      data: transfer,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to receive branch transfer",
    });
  }
};


