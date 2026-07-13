import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

// Database configurations
const MONGODB_URI = process.env.MONGODB_URI || "";

const databases = {
  manufacturer: "manufacturer",
  retailer: "retailer",
  customer: "customer",
  superadmin: "super_admin"
};

let connections: { [key: string]: mongoose.Connection } = {};

/**
 * Connect to a specific database
 */
export async function connectToDatabase(dbName: keyof typeof databases) {
  try {
    if (connections[dbName]) {
      return connections[dbName];
    }

    // Replace database name in URI
    const dbUri = MONGODB_URI.replace(/\/[^/?]+(?=\?|$)/, `/${databases[dbName]}`);
    
    const connection = mongoose.createConnection(dbUri);
    
    connection.on("connected", () => {
      console.log(`✅ Connected to ${databases[dbName]} database`);
    });

    connection.on("error", (err) => {
      console.error(`❌ Connection error for ${databases[dbName]}:`, err.message);
    });

    connection.on("disconnected", () => {
      console.log(`⚠️  Disconnected from ${databases[dbName]}`);
    });

    connections[dbName] = connection;
    return connection;
  } catch (error) {
    console.error(`❌ Failed to connect to ${databases[dbName]}:`, error);
    throw error;
  }
}

/**
 * Connect to all databases
 */
export async function connectAllDatabases() {
  try {
    console.log("\n================================================================================");
    console.log("🔗 Connecting to all databases...");
    console.log("================================================================================\n");

    await Promise.all([
      connectToDatabase("manufacturer"),
      connectToDatabase("retailer"),
      connectToDatabase("customer"),
      connectToDatabase("superadmin")
    ]);

    console.log("\n✅ All databases connected successfully!\n");
  } catch (error) {
    console.error("❌ Failed to connect to all databases:", error);
    throw error;
  }
}

/**
 * Get connection by database name
 */
export function getConnection(dbName: keyof typeof databases) {
  return connections[dbName];
}

/**
 * Get all connections
 */
export function getAllConnections() {
  return connections;
}

/**
 * Disconnect all databases
 */
export async function disconnectAllDatabases() {
  try {
    await Promise.all(
      Object.values(connections).map(conn => conn.close())
    );
    connections = {};
    console.log("✅ Disconnected from all databases");
  } catch (error) {
    console.error("❌ Error disconnecting from databases:", error);
  }
}

export default {
  connectToDatabase,
  connectAllDatabases,
  getConnection,
  getAllConnections,
  disconnectAllDatabases
};

