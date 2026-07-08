/**
 * Backend Verification & Validation Utility
 * Tests database connections, API routes, and data structure
 * Run this with: npm run dev (then call in separate terminal or via API)
 */

import express from 'express';
import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import Order from '../models/Order.js';
import Khata from '../models/Khata.js';
import Karikar from '../models/Karikar.js';
import Customer from '../models/Customer.js';
import Vendor from '../models/Vendor.js';
import Inventory from '../models/Inventory.js';
import Rate from '../models/Rate.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';

// ============= DATABASE CONNECTION VALIDATOR =============

export const validateDatabaseConnection = async () => {
  const result = {
    connected: false,
    database: '',
    uri: '',
    error: null as string | null,
  };

  try {
    if (mongoose.connection.readyState === 1) {
      result.connected = true;
      result.database = mongoose.connection.name || 'Unknown';
      const clientOptions = mongoose.connection.getClient().options as any;
      result.uri = clientOptions.connectionString?.split('?')[0] || 'Connected';
    } else {
      result.error = `Connection not ready. State: ${mongoose.connection.readyState}`;
    }
  } catch (error: any) {
    result.error = error.message;
  }

  return result;
};

// ============= COLLECTION STRUCTURE VALIDATOR =============

interface CollectionInfo {
  name: string;
  indexed: boolean;
  count: number;
  indexes: string[];
  schema: any;
  sampleDocument?: any;
}

export const validateCollectionStructures = async (): Promise<Record<string, CollectionInfo>> => {
  const collections: Record<string, CollectionInfo> = {};

  const models: Array<{ name: string; model: mongoose.Model<any> }> = [
    { name: 'Sale', model: Sale },
    { name: 'Order', model: Order },
    { name: 'Khata', model: Khata },
    { name: 'Karikar', model: Karikar },
    { name: 'Customer', model: Customer },
    { name: 'Vendor', model: Vendor },
    { name: 'Inventory', model: Inventory },
    { name: 'Rate', model: Rate },
    { name: 'User', model: User },
    { name: 'Branch', model: Branch },
  ];

  for (const { name, model } of models) {
    try {
      const count = await model.countDocuments();
      const sampleDocument = await model.findOne();
      const schema = model.schema.obj;
      
      // Get indexes
      const indexes = await model.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      collections[name] = {
        name,
        indexed: indexNames.length > 1,
        count,
        indexes: indexNames,
        schema: Object.keys(schema),
        sampleDocument: sampleDocument ? { _id: sampleDocument._id, ...JSON.parse(JSON.stringify(sampleDocument)).slice(0, 3) } : undefined,
      };
    } catch (error: any) {
      collections[name] = {
        name,
        indexed: false,
        count: 0,
        indexes: [],
        schema: [],
        sampleDocument: undefined,
      };
    }
  }

  return collections;
};

// ============= SORTING & INDEXING VALIDATOR =============

export const validateDataSorting = async () => {
  const sortingReport: Record<string, any> = {};

  try {
    // Test Sale sorting
    const salesByDate = await Sale.find().sort({ createdAt: -1 }).limit(5);
    sortingReport.sales = {
      field: 'createdAt (descending)',
      count: salesByDate.length,
      sample: salesByDate.map(s => ({ id: s._id, date: s.createdAt })),
    };

    // Test Order sorting
    const ordersByDate = await Order.find().sort({ createdAt: -1 }).limit(5);
    sortingReport.orders = {
      field: 'createdAt (descending)',
      count: ordersByDate.length,
      sample: ordersByDate.map(o => ({ id: o._id, date: o.createdAt })),
    };

    // Test Customer sorting
    const customersByName = await Customer.find().sort({ name: 1 }).limit(5);
    sortingReport.customers = {
      field: 'name (ascending)',
      count: customersByName.length,
      sample: customersByName.map(c => ({ id: c._id, name: c.name })),
    };

    // Test Karikar sorting by status
    const karikars = await Karikar.find().sort({ status: 1, createdAt: -1 }).limit(5);
    sortingReport.karikars = {
      field: 'status (asc), createdAt (desc)',
      count: karikars.length,
      sample: karikars.map(k => ({ id: k._id, name: k.name, status: k.status })),
    };

    // Test Vendor sorting
    const vendors = await Vendor.find().sort({ createdAt: -1 }).limit(5);
    sortingReport.vendors = {
      field: 'createdAt (descending)',
      count: vendors.length,
      sample: vendors.map(v => ({ id: v._id, name: v.name })),
    };
  } catch (error: any) {
    sortingReport.error = error.message;
  }

  return sortingReport;
};

// ============= API ROUTES VALIDATOR =============

export const validateAPIRoutes = async (app: any) => {
  const routes: Record<string, string[]> = {};

  // Stack routes from Express app
  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      const path = middleware.route.path;
      const methods = Object.keys(middleware.route.methods);
      routes[path] = methods.map((m: string) => m.toUpperCase());
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler: any) => {
        if (handler.route) {
          const path = handler.route.path;
          const methods = Object.keys(handler.route.methods);
          if (!routes[path]) routes[path] = [];
          routes[path].push(...methods.map((m: string) => m.toUpperCase()));
        }
      });
    }
  });

  return routes;
};

// ============= DATA INTEGRITY VALIDATOR =============

export const validateDataIntegrity = async () => {
  const integrity = {
    sales: {
      total: 0,
      withoutOrderId: 0,
      withoutCustomer: 0,
      withoutItems: 0,
      error: null as string | null,
    },
    orders: {
      total: 0,
      withoutCustomer: 0,
      withoutItems: 0,
      error: null as string | null,
    },
    khata: {
      total: 0,
      withoutCustomer: 0,
      error: null as string | null,
    },
    customers: {
      total: 0,
      withoutPhone: 0,
      error: null as string | null,
    },
  };

  try {
    // Sales integrity
    const sales = await Sale.find();
    integrity.sales.total = sales.length;
    integrity.sales.withoutOrderId = sales.filter(s => !s.orderId).length;
    integrity.sales.withoutCustomer = sales.filter(s => !s.customerName).length;
    integrity.sales.withoutItems = sales.filter(s => !s.items || s.items.length === 0).length;

    // Orders integrity
    const orders = await Order.find();
    integrity.orders.total = orders.length;
    integrity.orders.withoutCustomer = orders.filter(o => !o.customerName).length;
    integrity.orders.withoutItems = orders.filter(o => !o.items || o.items.length === 0).length;

    // Khata integrity
    const khatas = await Khata.find();
    integrity.khata.total = khatas.length;
    integrity.khata.withoutCustomer = khatas.filter(k => !k.customerName).length;

    // Customers integrity
    const customers = await Customer.find();
    integrity.customers.total = customers.length;
    integrity.customers.withoutPhone = customers.filter(c => !c.phone).length;
  } catch (error: any) {
    Object.keys(integrity).forEach(key => {
      (integrity as any)[key].error = error.message;
    });
  }

  return integrity;
};

// ============= CREATE VERIFICATION ENDPOINT =============

export const createVerificationRoute = (router: any) => {
  // Health check
  router.get('/verify/health', (req: any, res: any) => {
    res.json({
      status: 'ok',
      timestamp: new Date(),
      uptime: process.uptime(),
    });
  });

  // Database connection
  router.get('/verify/database', async (req: any, res: any) => {
    const dbStatus = await validateDatabaseConnection();
    res.json(dbStatus);
  });

  // Collection structures
  router.get('/verify/collections', async (req: any, res: any) => {
    const collections = await validateCollectionStructures();
    res.json(collections);
  });

  // Data sorting
  router.get('/verify/sorting', async (req: any, res: any) => {
    const sorting = await validateDataSorting();
    res.json(sorting);
  });

  // Data integrity
  router.get('/verify/integrity', async (req: any, res: any) => {
    const integrity = await validateDataIntegrity();
    res.json(integrity);
  });

  // Complete verification
  router.get('/verify/complete', async (req: any, res: any) => {
    const results = {
      database: await validateDatabaseConnection(),
      collections: await validateCollectionStructures(),
      sorting: await validateDataSorting(),
      integrity: await validateDataIntegrity(),
      timestamp: new Date(),
    };
    res.json(results);
  });

  return router;
};

// ============= CONSOLE LOGGER =============

export const logVerificationResults = async () => {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 BACKEND VERIFICATION REPORT');
  console.log('='.repeat(80));

  // Database
  console.log('\n📊 DATABASE CONNECTION');
  const dbStatus = await validateDatabaseConnection();
  console.log(dbStatus);

  // Collections
  console.log('\n📦 COLLECTION STRUCTURES');
  const collections = await validateCollectionStructures();
  Object.entries(collections).forEach(([name, info]: [string, CollectionInfo]) => {
    console.log(`  ✓ ${name}: ${info.count} documents, indexes: ${info.indexes.length}`);
  });

  // Data Sorting
  console.log('\n📈 DATA SORTING');
  const sorting = await validateDataSorting();
  Object.entries(sorting).forEach(([name, info]: [string, any]) => {
    if (info.error) {
      console.log(`  ✗ ${name}: ${info.error}`);
    } else {
      console.log(`  ✓ ${name}: ${info.count} records sorted by ${info.field}`);
    }
  });

  // Data Integrity
  console.log('\n✅ DATA INTEGRITY');
  const integrity = await validateDataIntegrity();
  Object.entries(integrity).forEach(([name, data]: [string, any]) => {
    if (data.error) {
      console.log(`  ✗ ${name}: ${data.error}`);
    } else {
      console.log(`  ✓ ${name}: Total: ${data.total}`);
      Object.entries(data).forEach(([field, value]: [string, any]) => {
        if (field !== 'error' && field !== 'total' && value > 0) {
          console.log(`    - ${field}: ${value}`);
        }
      });
    }
  });

  console.log('\n' + '='.repeat(80));
};
