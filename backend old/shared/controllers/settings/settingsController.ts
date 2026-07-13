import { Request, Response } from "express";
import { readSettings, writeSettings } from "../../../lib/settingsStore.js";

import { evaluateChargeRules } from "../../../lib/chargeEngine.js";

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const getSettings = async (_req: Request, res: Response) => {
  try {
    const current = await readSettings();

    return res.json({
      success: true,
      data: current,
    });
  } catch (error) {
    console.error("Failed to read settings", error);
    return res.status(500).json({
      success: false,
      error: "Failed to read settings",
    });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const payload = req.body as any;

    if (!isPlainObject(payload)) {
      return res.status(400).json({
        success: false,
        error: "settings payload must be an object",
      });
    }

    // Basic validation for known settings
    const validate = () => {
      const p = payload as any;
      if (p.chargeRules) {
        if (!Array.isArray(p.chargeRules)) throw new Error('chargeRules must be an array');
        p.chargeRules.forEach((r: any) => {
          if (typeof r !== 'object') throw new Error('each charge rule must be an object');
          if (!r.id) throw new Error('each charge rule must have an id');
          if (!r.type || !['percent','fixed'].includes(r.type)) throw new Error('rule type must be percent or fixed');
        });
      }
      if (p.financialYear) {
        if (!p.financialYear.startMonth || !p.financialYear.startDay) throw new Error('financialYear requires startMonth and startDay');
      }
      if (p.taxProfiles) {
        if (typeof p.taxProfiles !== 'object') throw new Error('taxProfiles must be an object keyed by state code');
      }
      if (p.communicationApis) {
        if (typeof p.communicationApis !== 'object') throw new Error('communicationApis must be an object');
      }
      if (p.paymentGateways) {
        if (typeof p.paymentGateways !== 'object') throw new Error('paymentGateways must be an object');
      }
      if (p.printerConfig) {
        if (!['thermal','A4','auto'].includes(p.printerConfig.type || 'auto')) throw new Error('printerConfig.type must be thermal, A4 or auto');
      }
    };

    validate();

    const current = await readSettings();
    const mergedSettings = {
      ...current.settings,
      ...payload,
    };

    const saved = await writeSettings(mergedSettings);

    return res.json({
      success: true,
      data: saved,
    });
  } catch (error) {
    console.error("Failed to update settings", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update settings",
    });
  }
};


