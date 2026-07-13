import { Request, Response } from "express";

interface HallmarkingBatchItem {
  itemNumber: string;
  huid?: string;
  metal: string;
  purity: string;
  weight?: number | null;
}

interface HallmarkingBatch {
  batchId: string;
  branchId: string;
  status: string;
  source: string;
  createdAt: string;
  itemCount: number;
  items: HallmarkingBatchItem[];
  preparedBy?: string;
  remarks?: string;
}

const hallmarkingBatches: HallmarkingBatch[] = [];

const normalizeString = (value: unknown, fallback = "") => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  return fallback;
};

const optionalString = (value: unknown) => {
  const normalized = normalizeString(value);
  return normalized ? normalized : undefined;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const generateBatchId = () =>
  `BATCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const buildItems = (body: Record<string, any>) => {
  const itemsFromArray = Array.isArray(body.items)
    ? body.items
        .map((item: any, index: number) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          return {
            itemNumber: normalizeString(item.itemNumber || item.id || `ITEM-${index + 1}`, `ITEM-${index + 1}`),
            huid: optionalString(item.huid || body.huid || body.huidIds?.[index]),
            metal: normalizeString(item.metal || body.metal, "Gold"),
            purity: normalizeString(item.purity || body.purity, "22K"),
            weight: item.weight !== undefined ? toNumber(item.weight, null) : null,
          };
        })
        .filter(Boolean)
    : [];

  if (itemsFromArray.length > 0) {
    return itemsFromArray as HallmarkingBatchItem[];
  }

  const requestedQuantity = Math.max(1, Math.floor(toNumber(body.quantity, 1)));

  return Array.from({ length: requestedQuantity }, (_, index) => ({
    itemNumber: `ITEM-${index + 1}`,
    huid: optionalString(body.huid || body.huidIds?.[index]),
    metal: normalizeString(body.metal, "Gold"),
    purity: normalizeString(body.purity, "22K"),
    weight: body.weight !== undefined ? toNumber(body.weight, null) : null,
  }));
};

export const createHallmarkingBatch = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, any>;
    const items = buildItems(body);

    if (!items.length) {
      return res.status(400).json({
        success: false,
        error: "items or quantity is required",
      });
    }

    const batch: HallmarkingBatch = {
      batchId: generateBatchId(),
      branchId: normalizeString(body.branchId, "MAIN"),
      status: normalizeString(body.status, "DISPATCHED"),
      source: "memory",
      createdAt: new Date().toISOString(),
      itemCount: items.length,
      items,
      preparedBy: optionalString(body.preparedBy),
      remarks: optionalString(body.remarks),
    };

    hallmarkingBatches.push(batch);

    return res.status(201).json({
      success: true,
      message: "Batch dispatched",
      data: batch,
    });
  } catch (error) {
    console.error("Failed to create hallmarking batch", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create hallmarking batch",
    });
  }
};

export const getHallmarkingBatches = () => hallmarkingBatches;


