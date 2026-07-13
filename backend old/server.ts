import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import Razorpay from "razorpay";
import jwt from "jsonwebtoken";
import { tenantLocalStorage } from "./lib/db.js";
import apiRouter from "./apiRoutes.js";
import { setRazorpayInstance } from "./lib/serverState.ts";
import { errorHandler } from "./lib/errorHandler.ts";
import { maintenanceMiddleware } from "./lib/authUtils.ts";
import { createVerificationRoute, logVerificationResults } from "./lib/verificationUtils.ts";
import { startNotificationScheduler, stopNotificationScheduler } from "./lib/notificationScheduler.ts";

const currentDir = process.cwd();
const hasLocalEnv = fs.existsSync(path.resolve(currentDir, ".env.local")) || fs.existsSync(path.resolve(currentDir, ".env"));
const backendRoot = hasLocalEnv ? currentDir : path.resolve(currentDir, "backend");
const frontendRoot = hasLocalEnv ? path.resolve(currentDir, "..", "frontend") : path.resolve(currentDir, "frontend");

dotenv.config({ path: path.resolve(backendRoot, ".env.local") });

const shouldServeFrontend = process.env.npm_lifecycle_event === "start" || process.env.SERVE_FRONTEND === "true";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HMR_PORT = process.env.HMR_PORT ? Number(process.env.HMR_PORT) : PORT + 1;
const HMR_ENABLED = process.env.DISABLE_HMR !== 'true';

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || "";

async function connectDatabase() {
  if (!MONGODB_URI) {
    console.warn("⚠️ MONGODB_URI not found in environment variables.");
    console.warn("⚠️ Server will run without database - using file-based storage");
    return false;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      retryWrites: true,
      w: 'majority',
    });

    console.log("✅ Connected to MongoDB Atlas");
    console.log(`📊 Database: ${mongoose.connection.name}`);

    mongoose.connection.on('disconnected', () => {
      console.log("⚠️ MongoDB disconnected");
    });

    mongoose.connection.on('error', (err) => {
      console.error("❌ MongoDB error:", err.message);
    });

    return true;
  } catch (err: any) {
    console.error("❌ MongoDB connection error:", err.message || err);
    console.error("⚠️ Server will run without database - using file-based storage");
    return false;
  }
}

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Tenant context middleware
app.use((req, res, next) => {
  let tenantId = "default-shop";
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.JWT_SECRET || "aurajewel_secret_key_2026";
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.tenantId) {
        tenantId = decoded.tenantId;
      }
    } catch (e) {
      // If token verification fails (expired or invalid), do not fall back to unverified decoding.
      console.warn("Tenant context middleware: Token verification failed.", e.message || e);
    }
  }
  tenantLocalStorage.run({ tenantId }, () => {
    next();
  });
});

// API Routes
app.use("/uploads", express.static(path.resolve(backendRoot, "uploads")));
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  next();
});
app.use("/api", maintenanceMiddleware);
app.use("/api", apiRouter);

// ✅ Verification Routes (for testing connections & database structure)
const verificationRouter = express.Router();
createVerificationRoute(verificationRouter);
app.use("/api", verificationRouter);

// API 404 handler: ensure unmatched API routes return JSON instead of falling through to frontend middleware
app.use("/api", (req, res, next) => {
  const error: any = new Error(`API endpoint not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
});

// Error Handler
app.use(errorHandler);

let razorpay: Razorpay | null = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  console.log("✅ Razorpay configured");
} else {
  console.warn("⚠️ RAZORPAY credentials not configured. Payments disabled.");
}

setRazorpayInstance(razorpay);

async function setupVite() {
  if (!shouldServeFrontend) {
    console.log("🟡 Frontend middleware disabled for backend-only execution.");
  } else if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      root: frontendRoot,
      configFile: path.join(frontendRoot, "vite.config.ts"),
      server: {
        middlewareMode: true,
        hmr: HMR_ENABLED ? { protocol: 'ws', host: 'localhost', port: HMR_PORT } : false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(frontendRoot, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`\n🚀 AuraJewel ERP Server running on http://localhost:${PORT}`);
    console.log(`📚 API Docs: http://localhost:${PORT}/api`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📦 Collections: http://localhost:${PORT}/api/health/collections`);
    console.log(`✅ Verification: http://localhost:${PORT}/api/verify/complete\n`);
    
    // Log verification results
    await logVerificationResults();
    // Start periodic notification scheduler
    try {
      startNotificationScheduler();
    } catch (err) {
      console.error("Failed to start notification scheduler", err);
    }
  });
}

async function startServer() {
  await connectDatabase();
  await setupVite();
}

startServer();

// Graceful shutdown: stop background workers
process.on("SIGINT", () => {
  console.log("Shutting down server...");
  try {
    stopNotificationScheduler();
  } catch (err) {
    console.error("Error during scheduler shutdown", err);
  }
  process.exit(0);
});
