/**
 * Task 1.1.4: OTP Verification API Integration Test Suite
 * Performs HTTP POST requests against /api/auth/otp/* on http://localhost:3000
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
console.log(' TASK 1.1.4: OTP VERIFICATION API INTEGRATION TEST SUITE');
console.log('================================================================\n');

async function runOtpIntegrationTests() {
  const targetEmail = `otp_int_${Date.now()}@ble-mesh.org`;

  console.log('--- 1. HTTP Integration: Request OTP (200 OK) ---');
  const reqRes = await makePostRequest('/api/auth/otp/request', {
    identifier: targetEmail,
    channel: 'EMAIL'
  });
  assertEquals(reqRes.statusCode, 200, 'HTTP POST /api/auth/otp/request returns 200 OK status');
  assertEquals(reqRes.body.success, true, 'Response payload indicates success');

  console.log('\n--- 2. HTTP Integration: Resend OTP (200 OK) ---');
  const resendRes = await makePostRequest('/api/auth/otp/resend', {
    identifier: targetEmail
  });
  assertEquals(resendRes.statusCode, 200, 'HTTP POST /api/auth/otp/resend returns 200 OK status');
  assertEquals(resendRes.body.success, true, 'Resend payload indicates success');

  console.log('\n--- 3. HTTP Integration: Invalid OTP Verification (400 Bad Request) ---');
  const invalidVerifyRes = await makePostRequest('/api/auth/otp/verify', {
    identifier: targetEmail,
    otp: '000000'
  });
  assertEquals(invalidVerifyRes.statusCode, 400, 'HTTP POST /api/auth/otp/verify with bad code returns 400 Bad Request');
  assert(invalidVerifyRes.body.error.includes('OTP_ERROR'), 'Error contains OTP_ERROR notification');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runOtpIntegrationTests().catch(err => {
  console.error('OTP Integration Test Error:', err);
  process.exit(1);
});
