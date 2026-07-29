/**
 * Task 3.1.7: Peer-to-Peer Message Exchange Unit Test Suite
 */

import { PeerMessageExchangeManager } from '../src/mesh/p2p_exchange.js';

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
console.log(' TASK 3.1.7: P2P MESSAGE EXCHANGE UNIT TEST SUITE');
console.log('================================================================\n');

async function runP2pExchangeTests() {
  const nodeA = new PeerMessageExchangeManager({ localNodeId: 'Node-Alpha' });
  const nodeB = new PeerMessageExchangeManager({ localNodeId: 'Node-Beta' });

  console.log('--- 1. Create Mesh Message Format, Encrypt & Sign ---');
  const packet = nodeA.createMeshMessage('Node-Beta', 'Emergency Medical Rescue Request', { ttl: 5 });

  assert(packet.packetId.startsWith('PKT-P2P-'), 'Subtask 1: Valid P2P mesh message packet formatted');
  assertEquals(packet.senderId, 'Node-Alpha', 'Subtask 1: Sender ID populated');
  assertEquals(packet.targetId, 'Node-Beta', 'Subtask 1: Target ID populated');
  assert(packet.encryptedBody !== undefined && packet.encryptedBody.ciphertext !== undefined, 'Subtask 2: Payload encrypted with AES-256-GCM');
  assert(packet.signature !== undefined && packet.signature.length === 64, 'Subtask 3: HMAC-SHA256 signature attached');
  assert(nodeA.tempMessageCache.has(packet.packetId), 'Subtask 8: Packet stored in temporary message cache');

  console.log('\n--- 2. Verify Incoming Signatures & Deliver to Target ---');
  const isValidSig = nodeB.verifyMessageSignature(packet);
  assertEquals(isValidSig, true, 'Subtask 4: Incoming HMAC signature verified successfully');

  const deliverRes = await nodeB.forwardMessage(packet);
  assertEquals(deliverRes.status, 'DELIVERED_TO_SELF', 'Subtask 5: Message delivered to target node');
  assertEquals(deliverRes.text, 'Emergency Medical Rescue Request', 'Subtask 2: AES-256-GCM ciphertext decrypted cleanly');

  // Test Tampered Signature Rejection
  let tamperErr = null;
  try {
    await nodeB.forwardMessage({ ...packet, signature: 'bad_signature_hash_123' });
  } catch (e) { tamperErr = e; }
  assert(tamperErr !== null, 'Subtask 4: Tampered HMAC signature rejected');

  console.log('\n--- 3. Prevent Duplicate Forwarding ---');
  const nodeRelay = new PeerMessageExchangeManager({ localNodeId: 'Node-Relay-1' });
  const newPacket = nodeA.createMeshMessage('Node-Gamma', 'SOS Flood Alert', { ttl: 3 });

  const relayRes1 = await nodeRelay.forwardMessage(newPacket);
  assertEquals(relayRes1.status, 'FORWARDED', 'Subtask 5: Initial packet forwarded by relay');
  assertEquals(relayRes1.remainingTtl, 2, 'Subtask 7: Packet TTL decremented from 3 to 2');

  const relayRes2 = await nodeRelay.forwardMessage(newPacket);
  assertEquals(relayRes2.status, 'DROPPED_DUPLICATE', 'Subtask 6: Duplicate packet dropped within 60s sliding window');

  console.log('\n--- 4. Manage Message TTL Expiration ---');
  const expiredPacket = nodeA.createMeshMessage('Node-Gamma', 'TTL Expired Alert', { ttl: 1 });
  const expiredRes = await nodeRelay.forwardMessage(expiredPacket);
  assertEquals(expiredRes.status, 'DROPPED_TTL_EXPIRED', 'Subtask 7: Packet with TTL <= 1 dropped on hop forwarding');

  console.log('\n--- 5. Temporary Message Cache Pruning ---');
  const staleRecord = nodeA.tempMessageCache.get(packet.packetId);
  staleRecord.createdAt = Date.now() - 70000; // Force age past 60s
  const prunedCount = nodeA.pruneTempCache(60000);
  assertEquals(prunedCount, 1, 'Subtask 8: Stale temporary message cache record pruned');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runP2pExchangeTests().catch(err => {
  console.error('P2P Exchange Test Error:', err);
  process.exit(1);
});
