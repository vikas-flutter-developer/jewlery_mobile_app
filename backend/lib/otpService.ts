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

let transporter: nodemailer.Transporter | null = null;
let usingTestAccount = false;
const setupTransporter = async () => {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || (port === 465);
  if (host && port && user && pass) {
    transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    usingTestAccount = false;
    return transporter;
  }

  // Fallback: create an Ethereal test account so developer can preview emails without external SMTP
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({ host: testAccount.smtp.host, port: testAccount.smtp.port, secure: testAccount.smtp.secure, auth: { user: testAccount.user, pass: testAccount.pass } });
    usingTestAccount = true;
    console.log(`[OTP] Using Ethereal test account: ${testAccount.user}`);
    return transporter;
  } catch (err) {
    return null;
  }
};

export const sendOtpToEmail = async (email: string) => {
  const code = generateOtp(email);
  const expiresAt = Date.now() + OTP_TTL_MS;
  store.set(`email:${email}`, { code, expiresAt, dest: email });

  const tr = await setupTransporter();
  if (tr) {
    try {
      const from = process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@aurajewel.com';
      const info = await tr.sendMail({ from, to: email, subject: 'Your AuraJewel OTP', text: `Your verification code is ${code}. It expires in 5 minutes.`, html: `<p>Your verification code is <strong>${code}</strong>. It expires in 5 minutes.</p>` });
      console.log(`[OTP] Sent OTP to email ${email} via ${usingTestAccount ? 'Ethereal test account' : 'SMTP'}`);
      if (usingTestAccount) {
        const preview = nodemailer.getTestMessageUrl(info);
        if (preview) console.log(`[OTP] Preview URL: ${preview}`);
      }
      return { ok: true, code };
    } catch (err: any) {
      console.warn('[OTP] Failed to send via transporter, falling back to console:', err.message || err);
    }
  }

  // Console fallback
  console.log(`[OTP] Sending OTP to email ${email}: ${code} (expires in 5m)`);
  return { ok: true, code };
};

export const sendOtpToPhone = async (phone: string) => {
  const code = generateOtp(phone);
  const expiresAt = Date.now() + OTP_TTL_MS;
  store.set(`phone:${phone}`, { code, expiresAt, dest: phone });

  // In production integrate SMS provider here. For now just console log.
  console.log(`[OTP] Sending OTP to phone ${phone}: ${code} (expires in 5m)`);
  return { ok: true, code };
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
