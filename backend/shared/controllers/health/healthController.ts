import { Request, Response } from "express";
import { isDbConnected } from "../../../lib/serverState.js";
import mongoose from "mongoose";

export const getHealth = (_req: Request, res: Response) => {
  const dbConnected = isDbConnected();
  
  // List all available API modules/routes
  const modules = [
    { name: 'inventory', path: '/api/inventory', description: 'Inventory Management' },
    { name: 'rates', path: '/api/rates', description: 'Metal Rates' },
    { name: 'customers', path: '/api/customers', description: 'Customer Management' },
    { name: 'vendors', path: '/api/vendors', description: 'Vendor Management' },
    { name: 'karikars', path: '/api/karikars', description: 'Karikar Management' },
    { name: 'orders', path: '/api/orders', description: 'Order Management' },
    { name: 'sales', path: '/api/sales', description: 'Sales Records' },
    { name: 'khata', path: '/api/khata', description: 'Khata/Ledger' },
    { name: 'wholesale', path: '/api/wholesale', description: 'Wholesale Operations' },
    { name: 'purchases', path: '/api/purchases', description: 'Purchase Orders' },
    { name: 'compliance', path: '/api/compliance', description: 'Compliance Management' },
    { name: 'huid', path: '/api/huid', description: 'HUID Management' },
    { name: 'hallmarking', path: '/api/hallmarking', description: 'Hallmarking Records' },
    { name: 'offers', path: '/api/offers', description: 'Offers & Coupons' },
    { name: 'users', path: '/api/users', description: 'User Management' },
    { name: 'auth', path: '/api/auth', description: 'Authentication' },
    { name: 'branches', path: '/api/branches', description: 'Branch Management' },
    { name: 'payments', path: '/api/payments', description: 'Payment Processing' },
  ];

  // Get MongoDB collections if connected
  let collections: string[] = [];
  if (dbConnected && mongoose.connection.db) {
    try {
      // This will be populated on next check after DB is connected
      collections = mongoose.connection.collections ? Object.keys(mongoose.connection.collections) : [];
    } catch (error) {
      // Collections will be empty if not yet loaded
    }
  }

  res.json({
    status: "ok",
    server: "running",
    database: {
      connected: dbConnected,
      status: dbConnected ? "connected" : "disconnected",
      uri: dbConnected ? "MongoDB Atlas" : "not configured",
      collections: collections.length > 0 ? collections : "No collections loaded yet"
    },
    modules: {
      total: modules.length,
      list: modules.map(m => ({
        name: m.name,
        path: m.path,
        description: m.description,
        status: "available"
      }))
    },
    timestamp: new Date().toISOString()
  });
};

export const getCollections = async (_req: Request, res: Response) => {
  try {
    const dbConnected = isDbConnected();
    
    if (!dbConnected) {
      return res.status(503).json({
        status: "error",
        message: "Database not connected",
        collections: []
      });
    }

    const collections = mongoose.connection.collections
      ? Object.keys(mongoose.connection.collections)
      : [];

    res.json({
      status: "success",
      database: "connected",
      collections: collections,
      count: collections.length,
      expectedCollections: [
        'inventory',
        'rates',
        'customers',
        'vendors',
        'karikars',
        'orders',
        'sales',
        'khata',
        'wholesale',
        'purchases',
        'compliance',
        'huid',
        'hallmarking',
        'offers',
        'users'
      ]
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Failed to fetch collections",
      collections: []
    });
  }
};


