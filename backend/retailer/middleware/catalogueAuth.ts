import { authMiddleware, roleMiddleware } from "../../lib/authUtils.js";

/** Roles allowed for catalogue management (upload, import, barcode print, delete) */
export const CATALOGUE_ROLES = ["SUPER_ADMIN", "ADMIN", "RETAILER", "STORE_MANAGER"] as const;

export const catalogueAuth = [authMiddleware, roleMiddleware([...CATALOGUE_ROLES])];

/** Manufacturer/Admin focused upload per spec — same set includes ADMIN + RETAILER (store admin) */
export const catalogueUploadAuth = catalogueAuth;
