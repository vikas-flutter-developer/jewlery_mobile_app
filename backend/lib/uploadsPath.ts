import path from "path";

export const getUploadsRoot = () => {
  const cwd = process.cwd();
  const isBackendCwd = path.basename(cwd) === "backend";
  return isBackendCwd ? path.join(cwd, "uploads") : path.join(cwd, "backend", "uploads");
};
