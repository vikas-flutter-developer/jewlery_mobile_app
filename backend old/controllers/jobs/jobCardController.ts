import { Request, Response } from "express";
import fs from "fs";
import {
  generateJobCard,
  listJobCardHistory,
  getLatestJobCard,
  incrementDownloadCount,
  incrementPrintCount,
} from "../../retailer/services/jobCardService.js";
import { logSecurityEvent } from "../../lib/securityAudit.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getActor = (req: Request) => (req as any).user?.id || "system";
const getStoreId = (req: Request) => (req as any).storeId || (req as any).user?.tenantId || "default-shop";

/** Returns true when a KARIKAR-role user should only see their own job cards */
const isKarikarScoped = (req: Request) => (req as any).user?.role === "KARIKAR";

/** Karikar ID extracted from the JWT (stored in user doc) */
const getKarikarId = (req: Request) => (req as any).user?.karikarId || (req as any).user?.id;

// ─── Handlers ─────────────────────────────────────────────────────────────────

export const generateJobCardHandler = async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId || "");
    const user = getActor(req);
    const result = await generateJobCard(jobId, user, {
      force: false,
      storeId: getStoreId(req),
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to generate job card" });
  }
};

export const regenerateJobCardHandler = async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId || "");
    const user = getActor(req);
    const result = await generateJobCard(jobId, user, {
      force: true,
      storeId: getStoreId(req),
    });
    // Audit: regenerate is already logged inside generateJobCard (job-card-regenerated)
    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to regenerate job card" });
  }
};

export const getJobCardHandler = async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId || "");
    const record = await getLatestJobCard(jobId);
    if (!record) return res.status(404).json({ success: false, error: "Job card not found" });

    // RBAC: Karikar may only view job cards assigned to them
    if (isKarikarScoped(req)) {
      const karikarId = getKarikarId(req);
      if (record.karikarId && karikarId && String(record.karikarId) !== String(karikarId)) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }
    }

    return res.status(200).json({ success: true, data: record });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to load job card" });
  }
};

export const getJobCardHistoryHandler = async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId || "");
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    // RBAC: Karikar can only view history for their own jobs
    if (isKarikarScoped(req)) {
      const latest = await getLatestJobCard(jobId);
      if (latest) {
        const karikarId = getKarikarId(req);
        if (latest.karikarId && karikarId && String(latest.karikarId) !== String(karikarId)) {
          return res.status(403).json({ success: false, error: "Access denied" });
        }
      }
    }

    const data = await listJobCardHistory(jobId, { page, limit });
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to load history" });
  }
};

export const getJobCardPdfHandler = async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.jobId || "");
    const isPrint = req.query.action === "print";
    const record = await getLatestJobCard(jobId);
    if (!record) return res.status(404).json({ success: false, error: "Job card not found" });

    // RBAC: Karikar may only download their own job card PDF
    if (isKarikarScoped(req)) {
      const karikarId = getKarikarId(req);
      if (record.karikarId && karikarId && String(record.karikarId) !== String(karikarId)) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }
    }

    const actor = getActor(req);

    // Increment counter & audit
    if (isPrint) {
      await incrementPrintCount(jobId).catch(() => {});
      await logSecurityEvent(actor, "job-card-printed", jobId, `Job card v${record.version} printed`);
    } else {
      await incrementDownloadCount(jobId).catch(() => {});
      await logSecurityEvent(actor, "job-card-downloaded", jobId, `Job card v${record.version} downloaded`);
    }

    // Stream from local path if available
    const pdfPath = record.pdfPath;
    if (pdfPath) {
      try {
        await fs.promises.access(pdfPath);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `${isPrint ? "inline" : "attachment"}; filename="jobcard-${jobId}-v${record.version}.pdf"`
        );
        const stream = fs.createReadStream(pdfPath);
        return stream.pipe(res);
      } catch {
        // fallthrough to URL redirect
      }
    }

    if (record.pdfUrl && /^https?:\/\//.test(record.pdfUrl)) {
      return res.redirect(record.pdfUrl);
    }

    return res.status(404).json({ success: false, error: "PDF not available" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to load job card PDF" });
  }
};
