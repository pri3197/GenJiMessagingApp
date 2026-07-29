/**
 * Task 1.1.6: Security Implementation Unit & Integration Test Suite
 */

import http from 'http';
import { SecurityEngine } from '../src/auth/security_middleware.js';

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

function makePostRequest(path, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: JSON.parse(body || '{}') });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: {} });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

console.log('================================================================');
console.log(' TASK 1.1.6: SECURITY IMPLEMENTATION TEST SUITE');
console.log('================================================================\n');

async function runSecurityTests() {
  const security = new SecurityEngine();

  console.log('--- 1. RS256 JWT Signing & Verification ---');
  const token = security.signRs256Jwt({ userId: 'user-sec-101', role: 'ADMIN' }, 900);
  assert(token.split('.').length === 3, 'RS256 JWT generated with 3 parts (header.payload.signature)');

  const verifiedPayload = security.verifyRs256Jwt(token);
  assertEquals(verifiedPayload.userId, 'user-sec-101', 'Verified RS256 JWT payload userId');
  assertEquals(verifiedPayload.role, 'ADMIN', 'Verified RS256 JWT payload role');

  console.log('\n--- 2. Refresh Token Rotation (One-Time Use Rotation) ---');
  const initialRefresh = security.issueRefreshToken('user-sec-101');
  const rotatedPair = security.rotateRefreshToken(initialRefresh);

  assert(rotatedPair.accessToken !== undefined, 'Rotated access token issued');
  assert(rotatedPair.refreshToken !== undefined && rotatedPair.refreshToken !== initialRefresh, 'New refresh token issued');
  assert(!security.refreshTokens.has(initialRefresh), 'Old refresh token invalidated');

  let staleErr = null;
  try {
    security.rotateRefreshToken(initialRefresh);
  } catch (e) { staleErr = e; }
  assertEquals(staleErr.statusCode, 401, 'Re-using old refresh token rejected with 401 Unauthorized');

  console.log('\n--- 3. IP Rate Limiting ---');
  const testIp = '192.168.1.50';
  for (let i = 0; i < 100; i++) {
    security.checkRateLimit(testIp);
  }
  let rateLimitErr = null;
  try {
    security.checkRateLimit(testIp);
  } catch (e) { rateLimitErr = e; }
  assertEquals(rateLimitErr.statusCode, 429, '101st request from IP rejected with 429 Rate Limit Exceeded');

  console.log('\n--- 4. HTTP Security & CORS Headers Integration ---');
  const res = await makePostRequest('/api/auth/register', {
    email: `sec_int_${Date.now()}@ble-mesh.org`,
    password: 'SecurePassword123!',
    full_name: 'Security User'
  });

  assertEquals(res.headers['strict-transport-security'], 'max-age=31536000; includeSubDomains', 'HTTPS HSTS security header configured');
  assertEquals(res.headers['x-content-type-options'], 'nosniff', 'X-Content-Type-Options header configured');
  assertEquals(res.headers['x-frame-options'], 'DENY', 'X-Frame-Options header configured');
  assertEquals(res.headers['access-control-allow-origin'], '*', 'CORS Access-Control-Allow-Origin header configured');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runSecurityTests().catch(err => {
  console.error('Security Test Error:', err);
  process.exit(1);
});
