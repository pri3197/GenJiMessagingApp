/**
 * Feature 3.2: Sound-Based Alternative Communication Channel Test Suite
 */

import http from 'http';
import { SoundChannelEngine } from '../src/mesh/sound_channel.js';
import { ChannelHandoverManager, CHANNEL_TYPE } from '../src/mesh/channel_handover.js';

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

function makeGetRequest(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 3000, path }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body || '{}') }));
    }).on('error', reject);
  });
}

function makePostRequest(path, payload = {}) {
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
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body || '{}') }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

console.log('================================================================');
console.log(' FEATURE 3.2: SOUND-BASED COMMUNICATION CHANNEL TEST SUITE');
console.log('================================================================\n');

async function runSoundChannelTests() {
  const soundEngine = new SoundChannelEngine();
  const handover = new ChannelHandoverManager({ soundEngine });

  console.log('--- 1. FSK Acoustic Encoding & Decryption ---');
  const messageText = 'Emergency Evacuation Signal Code Red';
  const chirpPayload = soundEngine.encodeToAudioFrequencies(messageText);

  assert(chirpPayload.frequencySequenceHz.length > 0, 'Task 1: Text encoded into FSK frequency tone sequence');
  assert(chirpPayload.encryptedPayload.ciphertext !== undefined, 'Task 1 & Security: Sound payload encrypted with AES-256-GCM');

  const decodedText = soundEngine.decodeFromAudioFrequencies(chirpPayload.frequencySequenceHz, chirpPayload.encryptedPayload);
  assertEquals(decodedText, messageText, 'Task 1 & Security: AES-256-GCM acoustic payload decrypted cleanly');

  console.log('\n--- 2. Privacy Compliance & Battery Impact Monitoring ---');
  const permRes = soundEngine.requestMicrophonePermission();
  assertEquals(permRes.granted, true, 'Privacy & Compliance: Microphone permission granted with explicit user consent');

  soundEngine.startListening();
  assertEquals(soundEngine.isListening, true, 'Task 1: Continuous microphone listening active');

  const batteryMetrics = soundEngine.getBatteryImpactMetrics();
  assertEquals(batteryMetrics.drainRatePerHour, '2.4% (Continuous Listening)', 'Battery Monitoring: Battery drain rate tracked (2.4%/hr)');

  console.log('\n--- 3. Automatic & Manual Channel Handover ---');
  assertEquals(handover.activeChannel, CHANNEL_TYPE.BLUETOOTH_MESH, 'Task 2: Default active transport is BLUETOOTH_MESH');

  // Manual Toggle
  const toggleLog = handover.switchChannel(CHANNEL_TYPE.ACOUSTIC_SOUND, true);
  assertEquals(toggleLog.activeChannel, CHANNEL_TYPE.ACOUSTIC_SOUND, 'Task 2: Manual toggle switched transport to ACOUSTIC_SOUND');
  assertEquals(handover.soundEngine.isListening, true, 'Task 2: Microphone listening auto-activated on acoustic channel toggle');

  // Automatic Failover when BLE Mesh fails
  handover.switchChannel(CHANNEL_TYPE.BLUETOOTH_MESH, false);
  handover.setChannelHealth(CHANNEL_TYPE.BLUETOOTH_MESH, false); // Simulate BLE Mesh radio failure
  assertEquals(handover.activeChannel, CHANNEL_TYPE.WIFI_DIRECT, 'Fallback Mechanism: Automatic seamless failover to Wi-Fi Direct on BLE failure');

  console.log('\n--- 4. HTTP API Integration Testing ---');
  const statusRes = await makeGetRequest('/api/sound/status');
  assertEquals(statusRes.statusCode, 200, 'UI Status Alert: GET /api/sound/status returns 200 OK');
  assert(statusRes.body.batteryImpact !== undefined, 'UI Status Alert: Response contains battery impact telemetry');

  const toggleApiRes = await makePostRequest('/api/sound/toggle', { channel: 'ACOUSTIC_SOUND' });
  assertEquals(toggleApiRes.statusCode, 200, 'UI Status Alert: POST /api/sound/toggle returns 200 OK');
  assertEquals(toggleApiRes.body.activeChannel, 'ACOUSTIC_SOUND', 'UI Status Alert: Transport toggled over HTTP API');

  const transmitApiRes = await makePostRequest('/api/sound/transmit', { text: 'Acoustic SOS Signal' });
  assertEquals(transmitApiRes.statusCode, 200, 'Task 1: POST /api/sound/transmit returns 200 OK');
  assert(transmitApiRes.body.chirpPayload.frequencySequenceHz.length > 0, 'Task 1: Returned FSK frequency tones array');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runSoundChannelTests().catch(err => {
  console.error('Sound Channel Test Error:', err);
  process.exit(1);
});
