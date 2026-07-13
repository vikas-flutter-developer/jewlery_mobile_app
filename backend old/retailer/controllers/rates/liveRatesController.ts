import { Request, Response } from "express";
import { Rate } from "../../models/index.js";
import { mockRates } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";

// Delete a rate by metal (mock or DB)
export const deleteRate = async (req: Request, res: Response) => {
  try {
    const { metal } = req.params;
    console.log(`[rates] DELETE request received: url=${req.originalUrl} method=${req.method} metal=${metal}`);
    if (!metal) return res.status(400).json({ error: 'Missing metal parameter' });
    if (!isDbConnected()) {
      const idx = mockRates.findIndex(r => r.metal.toLowerCase() === metal.toLowerCase());
      if (idx >= 0) mockRates.splice(idx, 1);
      return res.json({ success: true });
    }
    await Rate.findOneAndDelete({ metal } as any);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete rate' });
  }
};

// Helper: extract numeric-looking values from HTML and choose a plausible one
const fetchNumericFromHtml = (html: string) => {
  const matches = Array.from(html.matchAll(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+\.\d+)/g)).map(m => m[0].replace(/,/g, ''));
  if (matches.length === 0) return null;
  const nums = matches.map(n => parseFloat(n)).filter(n => !Number.isNaN(n));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => (a > b ? a : b));
};

const normalizeRateResponse = (response: any) => {
  if (!response || typeof response !== 'object') return {};
  if (response.gold24K || response.gold24k || response.gold24 || response.GOLD_24K) {
    return {
      gold24K: Number(response.gold24K ?? response.gold24k ?? response.gold24 ?? response.GOLD_24K),
      gold22K: Number(response.gold22K ?? response.gold22k ?? response.gold22 ?? response.GOLD_22K),
      silver: Number(response.silver ?? response.SILVER),
    };
  }
  return response;
};

const fetchIbjaRates = async () => {
  const apiKey = process.env.IBJA_API_KEY;
  const apiUrl = process.env.IBJA_API_URL || "https://api.ibja.in/v1/rates";
  if (!apiKey) return null;

  const response = await fetch(`${apiUrl}?api_key=${encodeURIComponent(apiKey)}&metals=GOLD24K,GOLD22K,SILVER`);
  if (!response.ok) return null;
  const data = await response.json();
  return normalizeRateResponse(data);
};

const updateRates = async (rates: Record<string, number>) => {
  if (!rates) return;
  const normalized = {
    gold24K: Number(rates.gold24K || rates.gold24k || 0),
    gold22K: Number(rates.gold22K || rates.gold22k || 0),
    silver: Number(rates.silver || 0),
  };
  if (isDbConnected()) {
    await Promise.all(
      Object.entries(normalized).map(([metal, value]) =>
        Rate.findOneAndUpdate(
          { metal } as any,
          { rate: value, updatedAt: new Date() } as any,
          { upsert: true, new: true }
        )
      )
    );
  } else {
    Object.entries(normalized).forEach(([metal, value]) => {
      const existing = mockRates.find((item) => item.metal.toLowerCase() === metal.toLowerCase());
      if (existing) existing.rate = value;
      else mockRates.push({ metal, rate: value });
    });
  }
};

export const getLiveRates = async (_req: Request, res: Response) => {
  try {
    const providers = {
      gold: process.env.GOLD_RATE_URL || 'https://www.google.com/finance/quote/XAUINR:INR',
      silver: process.env.SILVER_RATE_URL || 'https://www.google.com/finance/quote/XAGINR:INR',
      platinum: process.env.PLATINUM_RATE_URL || 'https://www.google.com/finance/quote/XPTINR:INR'
    };

    const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; AuraJewelBot/1.0)' };
    const urls = Object.values(providers);
    const texts = await Promise.all(urls.map(u => fetch(u, { headers }).then(r => r.text()).catch(() => '')));

    const [goldHtml, silverHtml, platinumHtml] = texts;
    const goldVal = fetchNumericFromHtml(goldHtml);
    const silverVal = fetchNumericFromHtml(silverHtml);
    const platinumVal = fetchNumericFromHtml(platinumHtml);

    const now = new Date().toISOString();
    const result: any = { updatedAt: now };
    if (goldVal) result.gold24K = Math.round(goldVal / 31.1034768);
    if (silverVal) result.silver = Math.round(silverVal / 31.1034768);
    if (platinumVal) result.platinum = Math.round(platinumVal / 31.1034768);

    if (!result.gold24K && !result.silver && !result.platinum) {
      const ibjaRates = await fetchIbjaRates();
      if (ibjaRates && (ibjaRates.gold24K || ibjaRates.silver)) {
        await updateRates(ibjaRates as any);
        Object.assign(result, ibjaRates);
      } else if (!isDbConnected()) {
        mockRates.forEach((r: any) => (result[r.metal.toLowerCase()] = r.rate));
      } else {
        const dbRates = await Rate.find();
        dbRates.forEach((r: any) => (result[r.metal.toLowerCase()] = r.rate));
      }
    }

    res.json(result);
  } catch (error: any) {
    console.error('Failed to fetch live rates', error);
    res.status(500).json({ error: error.message || 'Failed to fetch live rates' });
  }
};

export const importIbjaRates = async (_req: Request, res: Response) => {
  try {
    const rates = await fetchIbjaRates();
    if (!rates || (!rates.gold24K && !rates.gold22K && !rates.silver)) {
      return res.status(400).json({ success: false, error: "IBJA rate import failed or no data received. Configure IBJA_API_KEY and IBJA_API_URL." });
    }

    await updateRates(rates as any);
    return res.json({ success: true, data: rates, message: "Rates imported from IBJA successfully" });
  } catch (error: any) {
    console.error('IBJA import failed', error);
    return res.status(500).json({ success: false, error: error.message || 'IBJA import failed' });
  }
};


