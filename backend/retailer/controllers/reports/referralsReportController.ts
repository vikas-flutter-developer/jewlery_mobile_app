import { Request, Response } from "express";
import { CustomerReferral } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

/**
 * GET /api/reports/referrals
 */
export const getReferralsReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, referralStatus, format } = req.query;

    let query: any = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    if (referralStatus) {
      query.referralStatus = referralStatus;
    }

    let referrals: any[] = [];
    if (isDbConnected()) {
      referrals = await CustomerReferral.find(query)
        .populate("referrerCustomerId", "name phone")
        .populate("referredCustomerId", "name phone")
        .lean();
    } else {
      referrals = [
        {
          referralCode: "REF-ABCD",
          referralStatus: referralStatus || "PENDING",
          rewardStatus: "PENDING",
          rewardValue: 100,
          createdAt: new Date(),
          referrerCustomerId: { name: "Referrer Name", phone: "9876543210" },
          referredCustomerId: { name: "Referred Customer", phone: "8888888888" }
        }
      ];
    }

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Referrals Report");

      worksheet.columns = [
        { header: "Referrer Name", key: "referrer", width: 25 },
        { header: "Referrer Phone", key: "referrerPhone", width: 15 },
        { header: "Referred Customer", key: "referred", width: 25 },
        { header: "Referred Phone", key: "referredPhone", width: 15 },
        { header: "Referral Code", key: "code", width: 15 },
        { header: "Status", key: "status", width: 15 },
        { header: "Created At", key: "date", width: 20 },
      ];

      referrals.forEach(r => {
        worksheet.addRow({
          referrer: r.referrerCustomerId?.name || "N/A",
          referrerPhone: r.referrerCustomerId?.phone || "N/A",
          referred: r.referredCustomerId?.name || "N/A",
          referredPhone: r.referredCustomerId?.phone || "N/A",
          code: r.referralCode,
          status: r.referralStatus,
          date: r.createdAt ? new Date(r.createdAt).toISOString().split("T")[0] : "N/A",
        });
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=referrals_report.xlsx");
      await workbook.xlsx.write(res);
      return res.end();
    }

    if (format === "pdf") {
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=referrals_report.pdf");
      doc.pipe(res);

      doc.font("Helvetica-Bold").fontSize(18).text("AURAJEWEL - CUSTOMER REFERRALS REPORT", { align: "center" });
      doc.fontSize(10).font("Helvetica").text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" });
      doc.moveDown(2);

      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("Referrer", 40, doc.y, { width: 120, continued: true });
      doc.text("Referred Customer", 160, doc.y, { width: 120, continued: true });
      doc.text("Code", 280, doc.y, { width: 80, continued: true });
      doc.text("Status", 360, doc.y, { width: 100, continued: true });
      doc.text("Date", 460, doc.y, { width: 100 });
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(9);

      referrals.forEach(r => {
        if (doc.y > 700) doc.addPage();
        doc.text(r.referrerCustomerId?.name || "N/A", 40, doc.y, { width: 120, continued: true });
        doc.text(r.referredCustomerId?.name || "N/A", 160, doc.y, { width: 120, continued: true });
        doc.text(r.referralCode, 280, doc.y, { width: 80, continued: true });
        doc.text(r.referralStatus, 360, doc.y, { width: 100, continued: true });
        doc.text(r.createdAt ? new Date(r.createdAt).toISOString().split("T")[0] : "N/A", 460, doc.y, { width: 100 });
        doc.moveDown(0.5);
      });

      doc.end();
      return;
    }

    return res.json({ success: true, data: referrals });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/reports/referral-rewards
 */
export const getReferralRewardsReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, rewardStatus, format } = req.query;

    let query: any = {
      referralStatus: { $in: ["QUALIFIED", "REWARDED"] }
    };

    if (startDate || endDate) {
      query.updatedAt = {};
      if (startDate) query.updatedAt.$gte = new Date(startDate as string);
      if (endDate) query.updatedAt.$lte = new Date(endDate as string);
    }

    if (rewardStatus) {
      query.rewardStatus = rewardStatus;
    }

    let rewards: any[] = [];
    if (isDbConnected()) {
      rewards = await CustomerReferral.find(query)
        .populate("referrerCustomerId", "name phone")
        .lean();
    } else {
      rewards = [
        {
          referrerCustomerId: { name: "Referrer Name", phone: "9876543210" },
          rewardType: "POINTS",
          rewardValue: 100,
          rewardStatus: rewardStatus || "ISSUED",
          updatedAt: new Date()
        }
      ];
    }

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Referral Rewards Report");

      worksheet.columns = [
        { header: "Recipient Name", key: "referrer", width: 25 },
        { header: "Phone", key: "phone", width: 15 },
        { header: "Reward Type", key: "type", width: 15 },
        { header: "Reward Value", key: "value", width: 15 },
        { header: "Reward Status", key: "status", width: 15 },
        { header: "Issue Date", key: "date", width: 20 },
      ];

      rewards.forEach(r => {
        worksheet.addRow({
          referrer: r.referrerCustomerId?.name || "N/A",
          phone: r.referrerCustomerId?.phone || "N/A",
          type: r.rewardType,
          value: r.rewardValue,
          status: r.rewardStatus,
          date: r.updatedAt ? new Date(r.updatedAt).toISOString().split("T")[0] : "N/A",
        });
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=referral_rewards_report.xlsx");
      await workbook.xlsx.write(res);
      return res.end();
    }

    if (format === "pdf") {
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=referral_rewards_report.pdf");
      doc.pipe(res);

      doc.font("Helvetica-Bold").fontSize(18).text("AURAJEWEL - REFERRAL REWARDS DISTRIBUTION REPORT", { align: "center" });
      doc.fontSize(10).font("Helvetica").text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" });
      doc.moveDown(2);

      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("Recipient", 40, doc.y, { width: 130, continued: true });
      doc.text("Reward Type", 170, doc.y, { width: 100, continued: true });
      doc.text("Reward Value", 270, doc.y, { width: 100, continued: true });
      doc.text("Status", 370, doc.y, { width: 100, continued: true });
      doc.text("Issue Date", 470, doc.y, { width: 100 });
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(9);

      rewards.forEach(r => {
        if (doc.y > 700) doc.addPage();
        doc.text(r.referrerCustomerId?.name || "N/A", 40, doc.y, { width: 130, continued: true });
        doc.text(r.rewardType, 170, doc.y, { width: 100, continued: true });
        doc.text(String(r.rewardValue || 0), 270, doc.y, { width: 100, continued: true });
        doc.text(r.rewardStatus, 370, doc.y, { width: 100, continued: true });
        doc.text(r.updatedAt ? new Date(r.updatedAt).toISOString().split("T")[0] : "N/A", 470, doc.y, { width: 100 });
        doc.moveDown(0.5);
      });

      doc.end();
      return;
    }

    return res.json({ success: true, data: rewards });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
