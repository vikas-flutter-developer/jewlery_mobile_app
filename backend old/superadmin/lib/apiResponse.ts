import { Response } from "express";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * Standardized API response helpers used across the SaaS Subscription Module.
 * All responses follow the envelope: { success, data?, error?, pagination? }
 */

export const ApiResponse = {
  /** 200 OK with data payload */
  success<T>(res: Response, data: T, statusCode = 200): Response {
    return res.status(statusCode).json({ success: true, data });
  },

  /** 201 Created */
  created<T>(res: Response, data: T): Response {
    return res.status(201).json({ success: true, data });
  },

  /** 200 OK with paginated data */
  paginated<T>(
    res: Response,
    data: T[],
    pagination: PaginationMeta
  ): Response {
    return res.status(200).json({ success: true, data, pagination });
  },

  /** 4xx / 5xx error */
  error(res: Response, message: string, statusCode = 500): Response {
    return res.status(statusCode).json({ success: false, error: message });
  },

  /** 400 Bad Request */
  badRequest(res: Response, message: string): Response {
    return ApiResponse.error(res, message, 400);
  },

  /** 401 Unauthorized */
  unauthorized(res: Response, message = "Unauthorized"): Response {
    return ApiResponse.error(res, message, 401);
  },

  /** 403 Forbidden */
  forbidden(res: Response, message = "Access denied"): Response {
    return ApiResponse.error(res, message, 403);
  },

  /** 404 Not Found */
  notFound(res: Response, message = "Resource not found"): Response {
    return ApiResponse.error(res, message, 404);
  },

  /** 409 Conflict */
  conflict(res: Response, message: string): Response {
    return ApiResponse.error(res, message, 409);
  },

  /** 500 Internal Server Error */
  serverError(res: Response, message = "Internal server error"): Response {
    return ApiResponse.error(res, message, 500);
  },
};

/**
 * Parse pagination query params with safe defaults.
 */
export const parsePagination = (query: Record<string, any>) => {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Build PaginationMeta from total count + page/limit.
 */
export const buildPaginationMeta = (total: number, page: number, limit: number): PaginationMeta => ({
  total,
  page,
  limit,
  pages: Math.ceil(total / limit),
});
