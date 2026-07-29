/**
 * Task 1.1.6: Local Secure Storage Unit Test Suite
 */

import { LocalSecureStorageEngine } from '../src/storage/secure_storage.js';

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
console.log(' TASK 1.1.6: LOCAL SECURE STORAGE TEST SUITE');
console.log('================================================================\n');

function runSecureStorageTests() {
  const storage = new LocalSecureStorageEngine({ masterPassword: 'LocalVaultPassword2026!' });

  console.log('--- 1. AES-256-GCM Encryption & Decryption ---');
  const samplePayload = { secretData: 'Confidential Emergency SOP Code Red', timestamp: Date.now() };
  const encrypted = storage.encrypt(samplePayload);

  assert(encrypted.iv !== undefined && encrypted.iv.length === 24, 'Subtask 1: 96-bit AES-GCM IV generated');
  assert(encrypted.authTag !== undefined && encrypted.authTag.length === 32, 'Subtask 1: 128-bit AES-GCM AuthTag generated');
  assert(encrypted.ciphertext !== JSON.stringify(samplePayload), 'Subtask 1: Plaintext encrypted into ciphertext');

  const decrypted = storage.decrypt(encrypted);
  assertEquals(decrypted.secretData, samplePayload.secretData, 'Subtask 1: AES-256-GCM ciphertext decrypted cleanly');

  // Test Tampered Ciphertext Authentication Tag
  let tamperErr = null;
  try {
    const tampered = { ...encrypted, ciphertext: 'ff' + encrypted.ciphertext.slice(2) };
    storage.decrypt(tampered);
  } catch (e) { tamperErr = e; }
  assert(tamperErr !== null, 'Subtask 1: AES-256-GCM authTag rejected tampered ciphertext');

  console.log('\n--- 2. Cryptographic Keys Storage ---');
  const sampleKeys = { publicKey: '-----BEGIN PUBLIC KEY-----\nMIIB...', privateKey: '-----BEGIN PRIVATE KEY-----\nMIIE...' };
  storage.storeCryptographicKeys(sampleKeys);
  const loadedKeys = storage.loadCryptographicKeys();
  assertEquals(loadedKeys.publicKey, sampleKeys.publicKey, 'Subtask 2: Cryptographic keys stored and retrieved from encrypted vault');

  console.log('\n--- 3. Trusted Devices Storage ---');
  const trustedDevices = [
    { deviceId: 'DEV-101', name: 'Rescue Relay B1', mac: '00:11:22:33:44:55', trustedSince: Date.now() },
    { deviceId: 'DEV-102', name: 'Medical Team B2', mac: '00:11:22:33:44:66', trustedSince: Date.now() }
  ];
  storage.storeTrustedDevices(trustedDevices);
  const loadedDevices = storage.loadTrustedDevices();
  assertEquals(loadedDevices.length, 2, 'Subtask 3: Trusted devices array stored and retrieved');
  assertEquals(loadedDevices[0].name, 'Rescue Relay B1', 'Subtask 3: Trusted device record matches');

  console.log('\n--- 4. Offline Settings Storage ---');
  const offlineSettings = { offlineModeEnabled: true, syncIntervalMs: 30000, theme: 'dark' };
  storage.storeOfflineSettings(offlineSettings);
  const loadedSettings = storage.loadOfflineSettings();
  assertEquals(loadedSettings.offlineModeEnabled, true, 'Subtask 4: Offline settings stored and retrieved');

  console.log('\n--- 5. Cached Messages Storage ---');
  const cachedMessages = [
    { id: 'm1', text: 'SOS Medical Team dispatched', sender: 'Node B2', time: '14:20' },
    { id: 'm2', text: 'Confirmed, ETA 5 minutes', sender: 'You', time: '14:21' }
  ];
  storage.storeCachedMessages('chat-node-b2', cachedMessages);
  const loadedMessages = storage.loadCachedMessages('chat-node-b2');
  assertEquals(loadedMessages.length, 2, 'Subtask 5: Message thread cached securely');
  assertEquals(loadedMessages[0].text, 'SOS Medical Team dispatched', 'Subtask 5: Cached message content verified');

  console.log('\n--- 6. Routing Preferences Storage ---');
  const routingPrefs = { preferredGateway: 'Gateway-C2', enableFailover: true, maxHopLimit: 6 };
  storage.storeRoutingPreferences(routingPrefs);
  const loadedPrefs = storage.loadRoutingPreferences();
  assertEquals(loadedPrefs.preferredGateway, 'Gateway-C2', 'Subtask 6: Gateway routing preferences stored and retrieved');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runSecureStorageTests();
