import fs from "fs";
import path from "path";

export interface SettingsDocument {
  settings: Record<string, unknown>;
  updatedAt: string;
}

const storePath = path.resolve(process.cwd(), "backend", "data", "settingsStore.json");

const defaultDocument = (): SettingsDocument => ({
  settings: {},
  updatedAt: new Date().toISOString(),
});

const ensureStore = async () => {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(storePath)) {
    await fs.promises.writeFile(storePath, JSON.stringify(defaultDocument(), null, 2), "utf8");
  }
};

export const readSettings = async (): Promise<SettingsDocument> => {
  await ensureStore();

  try {
    const raw = await fs.promises.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SettingsDocument>;

    return {
      settings: parsed && typeof parsed.settings === "object" && parsed.settings !== null ? parsed.settings as Record<string, unknown> : {},
      updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return defaultDocument();
  }
};

export const writeSettings = async (settings: Record<string, unknown>): Promise<SettingsDocument> => {
  await ensureStore();
  const document: SettingsDocument = {
    settings,
    updatedAt: new Date().toISOString(),
  };

  await fs.promises.writeFile(storePath, JSON.stringify(document, null, 2), "utf8");
  return document;
};
