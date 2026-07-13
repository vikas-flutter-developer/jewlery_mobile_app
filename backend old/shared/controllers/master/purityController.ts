import { Request, Response } from "express";
import { upsertPurityConfig } from "../../../lib/masterDataStore.js";

export const createOrUpdatePurity = async (req: Request, res: Response) => {
  try {
    const { karat, purityPct, displayName } = req.body || {};

    if (!karat || typeof karat !== "string" || !karat.trim()) {
      return res.status(400).json({ error: "karat is required" });
    }

    if (typeof purityPct !== "number" || Number.isNaN(purityPct)) {
      return res.status(400).json({ error: "purityPct must be a number" });
    }

    if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
      return res.status(400).json({ error: "displayName is required" });
    }

    const config = await upsertPurityConfig({
      karat: karat.trim(),
      purityPct,
      displayName: displayName.trim(),
    });

    return res.status(201).json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to save purity config" });
  }
};


