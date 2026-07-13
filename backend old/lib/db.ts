import mongoose from "mongoose";
import { AsyncLocalStorage } from "async_hooks";

// Store the tenant ID in AsyncLocalStorage
export const tenantLocalStorage = new AsyncLocalStorage<{ tenantId?: string }>();

const EXCLUDED_MODELS = ["User", "Subscription", "RetailerOrder"];
const SYSTEM_MFR_ID = "shop-1779518126045-txlhr";

// Helper to create a dynamic model proxy
const createModelProxy = (modelName: string, schema: mongoose.Schema, collectionName: string, baseDbName: string) => {
  const getTenantModel = () => {
    const store = tenantLocalStorage.getStore();
    const tenantId = store?.tenantId;
    
    // Check if the model is excluded from partitioning
    const isExcluded = EXCLUDED_MODELS.includes(modelName);
    const dbName = !isExcluded && tenantId && tenantId !== "default-shop" && tenantId !== SYSTEM_MFR_ID
      ? `${baseDbName}_${tenantId}` 
      : baseDbName;
      
    console.log(`[DB Routing] Model: ${modelName}, tenantId: ${tenantId}, baseDb: ${baseDbName} -> dbName: ${dbName}`);
    const conn = mongoose.connection.useDb(dbName, { useCache: true });
    return conn.models[modelName] || conn.model(modelName, schema, collectionName);
  };

  const dummyTarget = function () {};
  return new Proxy(dummyTarget, {
    get(target, prop, receiver) {
      const model = getTenantModel();
      const value = Reflect.get(model, prop, model);
      if (typeof value === "function") {
        return value.bind(model);
      }
      return value;
    },
    set(target, prop, value, receiver) {
      const model = getTenantModel();
      return Reflect.set(model, prop, value, model);
    },
    construct(target, argumentsList, newTarget) {
      const model = getTenantModel();
      return Reflect.construct(model, argumentsList, model);
    }
  }) as any;
};

// Helper to create a proxied connection
const createConnectionProxy = (baseDbName: string) => {
  const defaultConn = mongoose.connection.useDb(baseDbName, { useCache: true });

  // Proxy the models object to return Model Proxies dynamically
  const modelsProxy = new Proxy({}, {
    get(target, prop) {
      if (typeof prop !== "string") return undefined;
      
      // If the model is already registered on the default connection, we can proxy it
      const defaultModel = defaultConn.models[prop];
      if (defaultModel) {
        return createModelProxy(prop, defaultModel.schema, defaultModel.collection.name, baseDbName);
      }
      return undefined;
    }
  });

  return new Proxy(defaultConn, {
    get(target, prop, receiver) {
      if (prop === "models") {
        return modelsProxy;
      }
      if (prop === "model") {
        // Intercept connection.model() compilation to return a Model Proxy
        return (name: string, schema: mongoose.Schema, collection?: string) => {
          const collName = collection || `${name.toLowerCase()}s`;
          // Register it on the default connection first so it's known
          if (!defaultConn.models[name]) {
            defaultConn.model(name, schema, collName);
          }
          return createModelProxy(name, schema, collName, baseDbName);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    }
  }) as mongoose.Connection;
};

export const getDbConnection = (dbName: string) => {
  return mongoose.connection.useDb(dbName, { useCache: true });
};

export const superAdminDb = getDbConnection("super_admin");
export const manufacturerDb = createConnectionProxy("manufacturer");
export const retailerDb = createConnectionProxy("retailer");
export const customerDb = getDbConnection("customer");
