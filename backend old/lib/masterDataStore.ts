import fs from "fs";
import path from "path";

export interface RateHistoryEntry {
  id: string;
  timestamp: string;
  rates: Record<string, number>;
  branchIds: string[];
  source: "sync";
}

export interface PurityConfig {
  id: string;
  karat: string;
  purityPct: number;
  displayName: string;
  updatedAt: string;
}

export interface MasterDataStore {
  rateHistory: RateHistoryEntry[];
  purityConfigs: PurityConfig[];
}

const storePath = path.resolve(process.cwd(), "backend", "data", "masterDataStore.json");

const defaultStore = (): MasterDataStore => ({
  rateHistory: [],
  purityConfigs: [],
});

const ensureStore = async (): Promise<void> => {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(storePath)) {
    await fs.promises.writeFile(storePath, JSON.stringify(defaultStore(), null, 2), "utf8");
  }
};

const readStore = async (): Promise<MasterDataStore> => {
  await ensureStore();

  try {
    const raw = await fs.promises.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<MasterDataStore>;

    return {
      rateHistory: Array.isArray(parsed.rateHistory) ? parsed.rateHistory : [],
      purityConfigs: Array.isArray(parsed.purityConfigs) ? parsed.purityConfigs : [],
    };
  } catch {
    return defaultStore();
  }
};

const writeStore = async (store: MasterDataStore): Promise<void> => {
  await fs.promises.writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
};

export const getRateHistory = async (): Promise<RateHistoryEntry[]> => {
  const store = await readStore();
  return store.rateHistory;
};

export const appendRateHistory = async (entry: RateHistoryEntry): Promise<RateHistoryEntry> => {
  const store = await readStore();
  store.rateHistory.push(entry);
  await writeStore(store);
  return entry;
};

export const getPurityConfigs = async (): Promise<PurityConfig[]> => {
  const store = await readStore();
  return store.purityConfigs;
};

export const upsertPurityConfig = async (config: Omit<PurityConfig, "id" | "updatedAt">): Promise<PurityConfig> => {
  const store = await readStore();
  const updatedAt = new Date().toISOString();
  const normalizedKarat = config.karat.trim().toUpperCase();
  const existingIndex = store.purityConfigs.findIndex((item) => item.karat.toUpperCase() === normalizedKarat);

  const normalizedConfig: PurityConfig = {
    id: existingIndex >= 0 ? store.purityConfigs[existingIndex].id : `purity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    karat: normalizedKarat,
    purityPct: Number(config.purityPct),
    displayName: config.displayName.trim(),
    updatedAt,
  };

  if (existingIndex >= 0) {
    store.purityConfigs[existingIndex] = normalizedConfig;
  } else {
    store.purityConfigs.push(normalizedConfig);
  }

  await writeStore(store);
  return normalizedConfig;
};
