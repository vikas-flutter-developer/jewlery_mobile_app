import { Request, Response } from "express";
import { Rate } from "../../models/index.js";
import { mockRates } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { appendRateHistory, getRateHistory as getStoredRateHistory } from "../../../lib/masterDataStore.js";

const normalizeStoredMetal = (metal: string) => {
  const normalized = metal.toLowerCase().replace(/[_\s-]+/g, "");

  if (normalized.includes("gold24") || normalized === "gold24k") return "gold24K";
  if (normalized.includes("gold22") || normalized === "gold22k") return "gold22K";
  if (normalized.includes("silver")) return "silver";

  return metal;
};

const normalizeRatePayload = (payload: Record<string, any>) => ({
  gold24K: Number(payload.gold24K),
  gold22K: Number(payload.gold22K),
  silver: Number(payload.silver),
});

const syncFallbackRates = (incomingRates: Record<string, number>) => {
  for (const [metal, rate] of Object.entries(incomingRates)) {
    const normalizedMetal = normalizeStoredMetal(metal);
    const existingRate = mockRates.find((item) => normalizeStoredMetal(item.metal) === normalizedMetal);

    if (existingRate) {
      existingRate.rate = rate;
      existingRate.metal = normalizedMetal;
    } else {
      mockRates.push({ metal: normalizedMetal, rate });
    }
  }
};

const buildSyncResponse = (rates: Record<string, number>, branchIds: string[]) => ({
  syncedRates: rates,
  branchIds,
});

export const getRates = async (_req: Request, res: Response) => {
  try {
    if (!isDbConnected()) return res.json(mockRates);
    const rates = await Rate.find();
    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rates" });
  }
};

export const createRate = async (req: Request, res: Response) => {
  try {
    const { metal, rate } = req.body;
    if (!isDbConnected()) {
      const idx = mockRates.findIndex(r => r.metal === metal);
      if (idx >= 0) mockRates[idx].rate = rate;
      else mockRates.push({ metal, rate });
      return res.json({ metal, rate });
    }
    const updatedRate = await Rate.findOneAndUpdate(
      { metal } as any,
      { rate, updatedAt: new Date() } as any,
      { upsert: true, new: true }
    );
    res.json(updatedRate);
  } catch (error) {
    res.status(500).json({ error: "Failed to update rates" });
  }
};

export const getRateHistory = async (_req: Request, res: Response) => {
  try {
    const history = await getStoredRateHistory();
    return res.json({ success: true, data: history });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch rate history" });
  }
};

export const syncRates = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const rawBranchIds: string[] = Array.isArray(body.branchIds)
      ? body.branchIds.map((item: unknown) => String(item)).filter(Boolean)
      : ["all"];
    const branchIds: string[] = rawBranchIds.includes("all") ? ["all"] : Array.from(new Set(rawBranchIds));

    const rates = normalizeRatePayload(body);
    const invalidKeys = Object.entries(rates).filter(([, value]) => Number.isNaN(value));

    if (invalidKeys.length > 0) {
      return res.status(400).json({ error: "gold24K, gold22K, and silver must be valid numbers" });
    }

    if (!isDbConnected()) {
      syncFallbackRates(rates);
    } else {
      await Promise.all(
        Object.entries(rates).map(([metal, rate]) =>
          Rate.findOneAndUpdate(
            { metal } as any,
            { rate, updatedAt: new Date() } as any,
            { upsert: true, new: true }
          )
        )
      );
    }

    const historyEntry = await appendRateHistory({
      id: `rate-history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      rates,
      branchIds,
      source: "sync",
    });

    return res.status(200).json({
      success: true,
      data: {
        ...buildSyncResponse(rates, branchIds),
        historyId: historyEntry.id,
        updatedAt: historyEntry.timestamp,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to sync rates" });
  }
};


