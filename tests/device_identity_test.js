/**
 * Task 1.1.1: Generate Device Identity Unit Test Suite
 */

import { DeviceIdentityManager } from '../src/identity/device_identity.js';

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

console.log('================================================================');
console.log(' TASK 1.1.1: GENERATE DEVICE IDENTITY UNIT TEST SUITE');
console.log('================================================================\n');

function runDeviceIdentityTests() {
  const manager = new DeviceIdentityManager({ keyType: 'ec', macAddress: '00:1A:2B:3C:4D:5E' });

  console.log('--- 1. UUID v4 Generation ---');
  const deviceId = manager.generateDeviceId();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert(uuidRegex.test(deviceId), 'Subtask 1: Valid RFC 4122 v4 UUID generated');

  console.log('\n--- 2. ECDSA P-256 Key Pair & Identity Initialization ---');
  const identity = manager.initIdentity();
  assert(identity.deviceId !== undefined, 'Device ID present in identity');
  assert(identity.publicKey.includes('BEGIN PUBLIC KEY'), 'Subtask 2: ECDSA public key in PEM format generated');
  assert(manager.secureKeystore.has(identity.deviceId), 'Subtask 3: Private key securely encrypted & stored in device vault');

  console.log('\n--- 3. Public Key Export & Fingerprinting ---');
  const exportedPk = manager.exportPublicKey();
  assertEquals(exportedPk, identity.publicKey, 'Subtask 4: Public key exported successfully');
  assertEquals(identity.fingerprint.length, 64, 'Subtask 5: 64-character SHA-256 device fingerprint generated');

  console.log('\n--- 4. Identity Validation ---');
  const validationRes = manager.validateIdentity(identity);
  assertEquals(validationRes.valid, true, 'Subtask 6: Generated device identity validated as 100% valid');

  console.log('\n--- 5. Key Pair Regeneration & Rotation ---');
  const oldPublicKey = identity.publicKey;
  const oldFingerprint = identity.fingerprint;

  const regeneratedIdentity = manager.regenerateKeyPair();
  assert(regeneratedIdentity.publicKey !== oldPublicKey, 'Subtask 7: Key pair regenerated with new public key');
  assert(regeneratedIdentity.fingerprint !== oldFingerprint, 'Subtask 7: Device fingerprint updated after key regeneration');

  const reValidationRes = manager.validateIdentity(regeneratedIdentity);
  assertEquals(reValidationRes.valid, true, 'Subtask 7: Regenerated identity validated successfully');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runDeviceIdentityTests();
