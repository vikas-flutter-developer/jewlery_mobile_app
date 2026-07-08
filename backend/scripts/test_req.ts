import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

async function run() {
  const PORT = process.env.PORT || 3000;
  const baseUrl = `http://localhost:${PORT}/api`;

  try {
    console.log("Logging in...");
    const loginRes = await axios.post(`${baseUrl}/auth/login`, {
      email: "branding@gmail.com",
      password: "branding"
    });

    console.log("Login response:", loginRes.data);
    const token = loginRes.data.data.token;
    console.log("Logged in successfully. Token length:", token ? token.length : 0);

    console.log("Fetching /retailer-orders...");
    const ordersRes = await axios.get(`${baseUrl}/retailer-orders`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("Orders status:", ordersRes.status);
    console.log("Orders data:", JSON.stringify(ordersRes.data, null, 2));

  } catch (err: any) {
    console.error("Request failed:", err.response ? err.response.data : err.message);
  }
}

run();
