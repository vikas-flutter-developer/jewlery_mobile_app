import { Request, Response } from "express";
import { Khata } from "../../models/index.js";
import { mockKhata } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";

export const getKhata = async (_req: Request, res: Response) => {
  try {
    if (!isDbConnected()) return res.json(mockKhata);
    const accounts = await Khata.find();
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch khata" });
  }
};

export const createKhata = async (req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      const account = { ...req.body, _id: `mock_k_${Date.now()}` };
      mockKhata.push(account);
      return res.json(account);
    }
    const account = new Khata(req.body);
    await account.save();
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: "Failed to create khata account" });
  }
};

export const updateKhata = async (req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.json({ ...req.body, _id: req.params.id });
    }
    const account = await Khata.findByIdAndUpdate(req.params.id as any, req.body as any, { new: true } as any);
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: "Failed to update khata account" });
  }
};


