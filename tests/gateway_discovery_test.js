/**
 * Task 3.1.3: Gateway Discovery Unit Test Suite
 */

import crypto from 'crypto';
import { GatewayDiscoveryPipeline, calculateGatewayScore } from '../src/mesh/gateway_selection.js';

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
console.log(' TASK 3.1.3: GATEWAY DISCOVERY UNIT TEST SUITE');
console.log('================================================================\n');

function runGatewayDiscoveryTests() {
  const secretKey = 'BLE_MESH_SECRET_KEY_TEST_2026';
  const pipeline = new GatewayDiscoveryPipeline({ secretKey, maxAgeMs: 1000 });

  console.log('--- 1. Heartbeat Packet Reception & HMAC Signature Verification ---');
  const gwId = 'Gateway-C1';
  const seqNum = 42;
  const timestamp = Date.now();
  const signatureInput = `${gwId}:${seqNum}:${timestamp}`;
  const validSignature = crypto.createHmac('sha256', secretKey).update(signatureInput).digest('hex');

  const validPacket = {
    type: 'HEARTBEAT_BEACON',
    gatewayId: gwId,
    sequenceNumber: seqNum,
    timestamp,
    signature: validSignature,
    metrics: { wanOnline: true, rssi: -55, battery: 92, load: 10, wanLatency: 450, hops: 1 }
  };

  const regResult = pipeline.registerBeacon(validPacket, true);
  assertEquals(regResult.gatewayId, 'Gateway-C1', 'Subtask 1 & 3: Received heartbeat & extracted gateway metrics');
  assertEquals(regResult.status, 'ONLINE', 'Subtask 1: Gateway status ONLINE');

  // Test Tampered Signature Rejection
  const tamperedPacket = { ...validPacket, signature: 'bad_signature_hash_123' };
  let sigErr = null;
  try { pipeline.registerBeacon(tamperedPacket, true); } catch (e) { sigErr = e; }
  assert(sigErr !== null, 'Subtask 2: Tampered HMAC signature rejected cleanly');

  console.log('\n--- 2. Calculate Gateway Score & Rank Gateways ---');
  // Register Gateway C2 with different metrics
  const gw2Id = 'Gateway-C2';
  const seq2 = 100;
  const ts2 = Date.now();
  const sig2 = crypto.createHmac('sha256', secretKey).update(`${gw2Id}:${seq2}:${ts2}`).digest('hex');

  const gw2Packet = {
    type: 'HEARTBEAT_BEACON',
    gatewayId: gw2Id,
    sequenceNumber: seq2,
    timestamp: ts2,
    signature: sig2,
    metrics: { wanOnline: true, rssi: -75, battery: 60, load: 40, wanLatency: 1200, hops: 2 }
  };

  pipeline.registerBeacon(gw2Packet);

  const scoreC1 = calculateGatewayScore(validPacket.metrics);
  const scoreC2 = calculateGatewayScore(gw2Packet.metrics);
  assert(scoreC1 > scoreC2, 'Subtask 4: Composite score calculated (Gateway C1 > Gateway C2)');

  const ranked = pipeline.getRankedGateways();
  assertEquals(ranked.length, 2, 'Subtask 5: 2 active gateways ranked');
  assertEquals(ranked[0].gatewayId, 'Gateway-C1', 'Subtask 5: Gateway C1 ranked #1 highest score');

  console.log('\n--- 3. Select Optimal Gateway ---');
  const optimal = pipeline.selectOptimalGateway();
  assertEquals(optimal.gatewayId, 'Gateway-C1', 'Subtask 6: Elected optimal gateway is Gateway-C1');

  console.log('\n--- 4. Detect Gateway Failure ---');
  // Force Gateway C2 lastSeen past 1000ms timeout
  const gw2Record = pipeline.gateways.get('Gateway-C2');
  gw2Record.lastSeen = Date.now() - 2000;

  const failures = pipeline.detectGatewayFailures(1000);
  assert(failures.includes('Gateway-C2'), 'Subtask 7: Gateway C2 failure detected');

  pipeline.pruneStaleGateways();
  assertEquals(pipeline.gateways.has('Gateway-C2'), false, 'Subtask 7: Failed gateway pruned from active discovery table');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runGatewayDiscoveryTests();
