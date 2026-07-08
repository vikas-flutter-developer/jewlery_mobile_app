import mongoose from "mongoose";
import Razorpay from "razorpay";

let razorpay: Razorpay | null = null;

export const setRazorpayInstance = (instance: Razorpay | null) => {
  razorpay = instance;
};

export const getRazorpayInstance = () => razorpay;

export const isDbConnected = () => mongoose.connection.readyState === 1 && !!mongoose.connection.db;
