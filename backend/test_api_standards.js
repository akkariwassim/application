'use strict';

const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

async function test() {
  console.log('🧪 Testing API Standards...');

  const results = {
    pass: 0,
    fail: 0,
    total: 0
  };

  const check = (name, response) => {
    results.total++;
    const hasSuccess = response.data && typeof response.data.success === 'boolean';
    const hasDataOrError = response.data && (response.data.data !== undefined || response.data.error !== undefined);
    
    if (hasSuccess && hasDataOrError) {
      console.log(`✅ [${name}] Format Correct`);
      results.pass++;
    } else {
      console.error(`❌ [${name}] Format Incorrect:`, response.data);
      results.fail++;
    }
  };

  try {
    // 1. Health check (Doesn't necessarily need the standard but good to check)
    try {
      const res = await axios.get(`${BASE_URL}/health`);
      console.log('✅ Health check OK');
    } catch (e) {
      console.error('❌ Health check failed');
    }

    // 2. Auth Login (with invalid credentials to check error format)
    try {
      const res = await axios.post(`${BASE_URL}/auth/login`, { email: 'invalid@test.com', password: 'wrong' });
      check('Login Success (Unexpected)', res);
    } catch (e) {
      if (e.response) check('Login Error', e.response);
      else console.error('❌ Login request failed');
    }

    // 3. Register (invalid data)
    try {
      const res = await axios.post(`${BASE_URL}/auth/register`, { name: '' });
      check('Register Success (Unexpected)', res);
    } catch (e) {
      if (e.response) check('Register Error', e.response);
      else console.error('❌ Register request failed');
    }

    console.log(`\n--- Test Summary ---`);
    console.log(`Passed: ${results.pass}`);
    console.log(`Failed: ${results.fail}`);
    console.log(`Total:  ${results.total}`);

    if (results.fail > 0) process.exit(1);
    process.exit(0);

  } catch (err) {
    console.error('❌ Testing Failed:', err.message);
    process.exit(1);
  }
}

test();
