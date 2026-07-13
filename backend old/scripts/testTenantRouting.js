import axios from 'axios';
import { spawn } from 'child_process';
import path from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function test() {
  console.log('Starting backend server...');
  const serverProcess = spawn('npx', ['tsx', 'backend/server.ts'], {
    cwd: path.resolve(__dirname, '..', '..'),
    env: { ...process.env, PORT: '3099' }, // Run on a different port to avoid conflicts
    shell: true
  });

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('[DB Routing]')) {
      console.log('SERVER LOG:', output.trim());
    } else if (output.includes('Server running')) {
      console.log('SERVER LOG: Server started successfully.');
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error('SERVER ERR:', data.toString().trim());
  });

  // Wait 15 seconds for server boot
  await new Promise(r => setTimeout(r, 15000));

  try {
    console.log('\n--- 1. Logging in as mahalebhavesh247@gmail.com ---');
    const loginRes = await axios.post('http://localhost:3099/api/auth/login', {
      email: 'mahalebhavesh247@gmail.com',
      password: '6969' // last 4 digits of 07558556969
    });

    console.log('Login Response:', JSON.stringify(loginRes.data, null, 2));

    let token = '';
    if (loginRes.data.requireOtp) {
      console.log('\n--- 1.1 Verifying OTP for login ---');
      const verifyRes = await axios.post('http://localhost:3099/api/auth/verify-otp', {
        email: 'mahalebhavesh247@gmail.com',
        code: '123456'
      });
      console.log('Verify Response:', JSON.stringify(verifyRes.data, null, 2));
      token = verifyRes.data.data.token;
    } else {
      token = loginRes.data.data.token;
    }

    console.log('\n--- 2. Fetching inventory with JWT token ---');
    const invRes = await axios.get('http://localhost:3099/api/inventory', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Inventory Response Success:', invRes.data.success);
    console.log('Inventory Items Count:', invRes.data.data?.length || 0);

  } catch (error) {
    console.error('Test Request Failed:', error.response?.data ? JSON.stringify(error.response.data) : error.stack || error);
  } finally {
    console.log('\nStopping backend server...');
    serverProcess.kill();
  }
}

test().catch(console.error);
