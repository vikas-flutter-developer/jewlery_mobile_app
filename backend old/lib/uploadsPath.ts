import path from "path";
import fs from "fs";

export const getUploadsRoot = () => {
  const cwd = process.cwd();
  const isBackendCwd = fs.existsSync(path.resolve(cwd, ".env.local")) || fs.existsSync(path.resolve(cwd, ".env")) || fs.existsSync(path.resolve(cwd, "package.json"));
  return isBackendCwd ? path.join(cwd, "uploads") : path.join(cwd, "backend", "uploads");
};
