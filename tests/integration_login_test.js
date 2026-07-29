/**
 * Task 1.1.3: User Login API Integration Test Suite
 * Performs HTTP POST requests against /api/auth/login on http://localhost:3000
 */

import http from 'http';

let passed = 0;
let failed = 0;

function assertEquals(actual, expected, message) {
  if (actual === expected) {
    console.log(`  ✓ PASS: ${message} (Got: ${actual})`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message} (Expected: ${expected}, Got: ${actual})`);
    failed++;
  }
}

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function makePostRequest(path, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(body || '{}') });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: {} });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

console.log('================================================================');
console.log(' TASK 1.1.3: USER LOGIN API INTEGRATION TEST SUITE');
console.log('================================================================\n');

async function runLoginIntegrationTests() {
  console.log('--- 1. HTTP Integration: Register & Login (200 OK) ---');
  const userEmail = `login_int_${Date.now()}@ble-mesh.org`;
  const userPassword = 'LoginPassword123!';

  // First register user
  const regRes = await makePostRequest('/api/auth/register', {
    email: userEmail,
    password: userPassword,
    full_name: 'Integration Login User'
  });
  assertEquals(regRes.statusCode, 201, 'User registered via HTTP POST /api/auth/register');

  // Perform login
  const loginRes = await makePostRequest('/api/auth/login', {
    email: userEmail,
    password: userPassword
  });

  assertEquals(loginRes.statusCode, 200, 'HTTP POST /api/auth/login returns 200 OK status');
  assertEquals(loginRes.body.success, true, 'Response JSON payload indicates success');
  assert(loginRes.body.accessToken !== undefined, 'Access token returned in HTTP login response');
  assert(loginRes.body.refreshToken !== undefined, 'Refresh token returned in HTTP login response');

  console.log('\n--- 2. HTTP Integration: Wrong Password (401 Unauthorized) ---');
  const badLoginRes = await makePostRequest('/api/auth/login', {
    email: userEmail,
    password: 'WrongPassword123!'
  });
  assertEquals(badLoginRes.statusCode, 401, 'HTTP POST with wrong password returns 401 Unauthorized');
  assert(badLoginRes.body.error.includes('AUTHENTICATION_ERROR'), 'Error message contains AUTHENTICATION_ERROR');

  console.log('\n--- 3. HTTP Integration: Missing Credentials (400 Bad Request) ---');
  const missingRes = await makePostRequest('/api/auth/login', {
    email: userEmail
  });
  assertEquals(missingRes.statusCode, 400, 'HTTP POST with missing password returns 400 Bad Request');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runLoginIntegrationTests().catch(err => {
  console.error('Login Integration Test Error:', err);
  process.exit(1);
});
