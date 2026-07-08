import { Request, Response } from "express";
import mongoose from "mongoose";
import Customer from "../../../models/Customer.js";
import { findFallbackCustomerById } from "../../../lib/fallbackStore.js";

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getCustomerLoyalty = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: "customerId is required",
      });
    }

    if (mongoose.connection.readyState === 1) {
      const customer = await Customer.findById(customerId).lean();

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: "Customer not found",
        });
      }

      return res.json({
        success: true,
        data: {
          customerId,
          points: toNumber(customer.loyaltyPoints ?? 0),
          totalPurchases: toNumber(customer.totalPurchases ?? 0),
          loyaltyWalletId: customer.loyaltyWalletId ?? null,
        },
      });
    }

    const fallbackCustomer = await findFallbackCustomerById(customerId);

    if (!fallbackCustomer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    return res.json({
      success: true,
      data: {
        customerId,
        points: toNumber(fallbackCustomer.loyaltyPoints ?? 0),
        totalPurchases: toNumber(fallbackCustomer.totalPurchases ?? 0),
        loyaltyWalletId: fallbackCustomer.loyaltyWalletId ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to fetch customer loyalty", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch customer loyalty",
    });
  }
};


