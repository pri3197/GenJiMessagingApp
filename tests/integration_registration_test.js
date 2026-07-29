/**
 * Task 1.1.2: User Registration API Integration Test Suite
 * Performs HTTP POST requests against /api/auth/register on http://localhost:3000
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
console.log(' TASK 1.1.2: USER REGISTRATION API INTEGRATION TEST SUITE');
console.log('================================================================\n');

async function runRegistrationIntegrationTests() {
  console.log('--- 1. HTTP Integration: Successful User Registration (201 Created) ---');
  const uniqueEmail = `integration_${Date.now()}@ble-mesh.org`;
  const res1 = await makePostRequest('/api/auth/register', {
    email: uniqueEmail,
    phone_number: '+15558889999',
    password: 'StrongPassword123!',
    full_name: 'Integration Test User'
  });

  assertEquals(res1.statusCode, 201, 'HTTP POST /api/auth/register returns 201 Created status');
  assertEquals(res1.body.success, true, 'Response JSON payload indicates success');
  assertEquals(res1.body.user.email, uniqueEmail, 'Returned registered user email matches');
  assert(res1.body.verificationToken !== undefined, 'Verification token returned in HTTP response');

  console.log('\n--- 2. HTTP Integration: Invalid Email Validation (400 Bad Request) ---');
  const res2 = await makePostRequest('/api/auth/register', {
    email: 'bademailformat',
    password: 'StrongPassword123!',
    full_name: 'Bad Email User'
  });
  assertEquals(res2.statusCode, 400, 'HTTP POST with bad email format returns 400 Bad Request');
  assert(res2.body.error.includes('VALIDATION_ERROR'), 'Error message contains VALIDATION_ERROR');

  console.log('\n--- 3. HTTP Integration: Duplicate Email Registration (409 Conflict) ---');
  const res3 = await makePostRequest('/api/auth/register', {
    email: uniqueEmail,
    password: 'StrongPassword123!',
    full_name: 'Duplicate User'
  });
  assertEquals(res3.statusCode, 409, 'HTTP POST with duplicate email returns 409 Conflict');
  assert(res3.body.error.includes('DUPLICATE_ERROR'), 'Error message contains DUPLICATE_ERROR');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runRegistrationIntegrationTests().catch(err => {
  console.error('Integration Test Error:', err);
  process.exit(1);
});
