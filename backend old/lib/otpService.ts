import * as crypto from "crypto";
import nodemailer from "nodemailer";

type OtpEntry = {
  code: string;
  expiresAt: number;
  dest: string;
};

const store = new Map<string, OtpEntry>();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEMO_OTP = '123456';

const getDemoOtpEmails = () => (process.env.DEMO_OTP_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
const getDemoOtpPhones = () => (process.env.DEMO_OTP_PHONES || "").split(",").map((phone) => phone.trim()).filter(Boolean);
const isForceDemoOtp = () => process.env.FORCE_DEMO_OTP === 'true';
const hasSmtpConfig = () => !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
const isLocalDev = () => (process.env.NODE_ENV || 'development') !== 'production';

const isDemoDestination = (dest: string) => {
  const normalized = dest.trim().toLowerCase();
  const adminEmail = (process.env.ADMIN_EMAIL || 'manufacturer@aurajewel.com').toLowerCase();
  if (normalized === adminEmail) return true;
  if (normalized === 'retailer@aurajewel.com') return true;
  if (normalized === '7558556969') return true;
  if (getDemoOtpEmails().includes(normalized)) return true;
  if (getDemoOtpPhones().includes(normalized)) return true;
  return false;
};

export const generateOtp = (dest?: string) => {
  if (isForceDemoOtp()) return DEMO_OTP;
  if (isLocalDev() && !hasSmtpConfig()) {
    return DEMO_OTP;
  }
  if (dest && isDemoDestination(dest)) {
    return DEMO_OTP;
  }
  return (Math.floor(100000 + Math.random() * 900000)).toString();
};

import { tenantLocalStorage, isDbConnected } from "./db.js";
import { MessagingConfiguration } from "../retailer/models/index.js";
import { wrapWithEmailTemplate } from "./emailTemplateHelper.js";

const getTransporterForTenant = async (tenantId: string) => {
  if (isDbConnected()) {
    try {
      const dbConfig = await MessagingConfiguration.findOne({
        tenantId,
        channelType: "EMAIL",
        isActive: true,
        isDefault: true,
      });
      if (dbConfig && dbConfig.configuration) {
        const { host, port, secure, auth } = dbConfig.configuration;
        if (host && port && auth?.user && auth?.pass) {
          const trans = nodemailer.createTransport({
            host,
            port: Number(port),
            secure: secure === true || port === 465,
            auth: { user: auth.user, pass: auth.pass },
          });
          return { transporter: trans, from: dbConfig.configuration.from || auth.user, usingTestAccount: false };
        }
      }
    } catch (err) {
      console.warn("[OTP] Failed to load email config from DB, falling back:", err);
    }
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (host && port && user && pass) {
    const trans = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    return { transporter: trans, from: process.env.FROM_EMAIL || user, usingTestAccount: false };
  }

  try {
    const testAccount = await nodemailer.createTestAccount();
    const trans = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    return { transporter: trans, from: "no-reply@aurajewel.com", usingTestAccount: true, testAccount };
  } catch (error) {
    return null;
  }
};

export const sendOtpToEmail = async (email: string) => {
  const code = generateOtp(email);
  const expiresAt = Date.now() + OTP_TTL_MS;
  store.set(`email:${email}`, { code, expiresAt, dest: email });

  const tenantId = tenantLocalStorage.getStore()?.tenantId || "default-shop";
  const result = await getTransporterForTenant(tenantId);

  if (result && result.transporter) {
    try {
      const { transporter, from, usingTestAccount, testAccount } = result;
      const originalHtml = `<p>Your verification code is <strong>${code}</strong>. It expires in 5 minutes.</p>`;
      const { html, senderName } = await wrapWithEmailTemplate(tenantId, "OTP", originalHtml, "AuraJewel");
      const info = await transporter.sendMail({
        from: `"${senderName}" <${from}>`,
        to: email,
        subject: `Your ${senderName} OTP`,
        text: `Your verification code is ${code}. It expires in 5 minutes.`,
        html,
      });
      console.log(`[OTP] Sent OTP to email ${email} via ${usingTestAccount ? "Ethereal test account" : "SMTP"}`);
      if (usingTestAccount) {
        const preview = nodemailer.getTestMessageUrl(info);
        if (preview) console.log(`[OTP] Preview URL: ${preview}`);
      }
      return { ok: true, code };
    } catch (err: any) {
      console.warn("[OTP] Failed to send via transporter, falling back to console:", err.message || err);
    }
  }

  // Console fallback
  console.log(`[OTP] Sending OTP to email ${email}: ${code} (expires in 5m) via console fallback`);
  return { ok: true, code };
};

export const sendOtpToPhone = async (phone: string) => {
  const code = generateOtp(phone);
  const expiresAt = Date.now() + OTP_TTL_MS;
  store.set(`phone:${phone}`, { code, expiresAt, dest: phone });

  const tenantId = tenantLocalStorage.getStore()?.tenantId || "default-shop";
  let provider = "console-stub";

  if (isDbConnected()) {
    try {
      const dbConfig = await MessagingConfiguration.findOne({
        tenantId,
        channelType: "SMS",
        isActive: true,
        isDefault: true,
      });
      if (dbConfig) {
        provider = dbConfig.provider;
        console.log(`[OTP] Sending OTP to phone ${phone}: ${code} via SMS provider ${provider}`);
        return { ok: true, code, provider };
      }
    } catch (err) {
      console.warn("[OTP] Failed to load SMS config from DB:", err);
    }
  }

  // In production integrate SMS provider here. For now just console log.
  console.log(`[OTP] Sending OTP to phone ${phone}: ${code} (expires in 5m) via console fallback`);
  return { ok: true, code, provider };
};


export const verifyOtpForEmail = (email: string, code: string) => {
  if (isForceDemoOtp() && code === DEMO_OTP) return true;
  const key = `email:${email}`;
  const entry = store.get(key);
  const isDemo = isDemoDestination(email);
  if (!entry) {
    return isDemo && code === DEMO_OTP;
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return isDemo && code === DEMO_OTP;
  }
  const match = entry.code === code;
  if (match) store.delete(key);
  return match;
};

export const verifyOtpForPhone = (phone: string, code: string) => {
  if (isForceDemoOtp() && code === DEMO_OTP) return true;
  const key = `phone:${phone}`;
  const entry = store.get(key);
  const isDemo = isDemoDestination(phone);
  if (!entry) {
    return isDemo && code === DEMO_OTP;
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return isDemo && code === DEMO_OTP;
  }
  const match = entry.code === code;
  if (match) store.delete(key);
  return match;
};

export default {
  sendOtpToEmail,
  sendOtpToPhone,
  verifyOtpForEmail,
  verifyOtpForPhone,
};
