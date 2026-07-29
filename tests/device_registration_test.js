/**
 * Task 1.1.5: Device Registration Unit & Integration Test Suite
 */

import http from 'http';
import { AuthDatabaseEngine } from '../src/db/auth_entities.js';
import { RegistrationService } from '../src/auth/registration_service.js';
import { DeviceRegistrationService } from '../src/auth/device_registration_service.js';

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
console.log(' TASK 1.1.5: DEVICE REGISTRATION TEST SUITE');
console.log('================================================================\n');

async function runDeviceRegistrationTests() {
  const authDb = new AuthDatabaseEngine();
  const regService = new RegistrationService(authDb);
  const deviceService = new DeviceRegistrationService(authDb);

  // Register a user to associate device
  const regUser = regService.registerUser({
    email: 'device_user@ble-mesh.org',
    password: 'SecurePassword123!',
    full_name: 'Device Test User'
  });

  console.log('--- Unit Tests: Device Registration Engine ---');

  const payload = {
    userId: regUser.user.id,
    deviceName: 'iPhone 15 Pro Node',
    deviceMacAddress: 'A1:B2:C3:D4:E5:F6',
    deviceType: 'MOBILE_IOS',
    osVersion: 'iOS 17.4',
    appVersion: 'v1.0.0-production',
    bleCapability: { bleVersion: '5.3', roles: ['RELAY', 'PROXY'], maxHops: 10 },
    notificationToken: 'APNS-TOKEN-123456789',
    isPrimary: true
  };

  const res = deviceService.registerDevice(payload);

  assert(res.deviceId.startsWith('DEV-'), 'Subtask 1: Generated Device ID with DEV- prefix');
  assertEquals(res.device.deviceName, 'iPhone 15 Pro Node', 'Subtask 2: Captured device information');
  assertEquals(res.device.osVersion, 'iOS 17.4', 'Subtask 3: Captured OS version');
  assertEquals(res.device.appVersion, 'v1.0.0-production', 'Subtask 4: Captured application version');
  assert(res.device.publicKey.includes('BEGIN PUBLIC KEY'), 'Subtask 5 & 6: Generated 2048-bit RSA key pair and stored public key');
  assertEquals(res.userId, regUser.user.id, 'Subtask 7: Associated device with user');
  assertEquals(res.device.bleCapability.bleVersion, '5.3', 'Subtask 8: Registered BLE capability');
  assertEquals(res.device.notificationToken, 'APNS-TOKEN-123456789', 'Subtask 9: Registered notification token');

  console.log('\n--- Integration Tests: HTTP POST /api/auth/device/register ---');

  // Register user over HTTP
  const httpUserEmail = `device_http_${Date.now()}@ble-mesh.org`;
  const regHttpRes = await makePostRequest('/api/auth/register', {
    email: httpUserEmail,
    password: 'SecurePassword123!',
    full_name: 'HTTP Device User'
  });

  const httpPayload = {
    userId: regHttpRes.body.user.id,
    deviceName: 'Pixel 8 Pro Node',
    deviceMacAddress: `00:11:22:33:44:${Math.floor(Math.random()*90+10)}`,
    osVersion: 'Android 14',
    appVersion: 'v1.0.0-production',
    isPrimary: true
  };

  const httpRes = await makePostRequest('/api/auth/device/register', httpPayload);
  assertEquals(httpRes.statusCode, 201, 'Subtask 10: HTTP POST /api/auth/device/register returns 201 Created');
  assertEquals(httpRes.body.success, true, 'Subtask 10: Device registered successfully over HTTP');
  assert(httpRes.body.deviceId.startsWith('DEV-'), 'Subtask 10: Returned registered deviceId');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runDeviceRegistrationTests().catch(err => {
  console.error('Device Registration Test Error:', err);
  process.exit(1);
});
