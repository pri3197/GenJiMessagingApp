/**
 * Task 3.1.6: Distributed Knowledge Synchronisation Unit Test Suite
 */

import { DistributedKnowledgeSyncEngine } from '../src/mesh/knowledge_sync.js';

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
console.log(' TASK 3.1.6: DISTRIBUTED KNOWLEDGE SYNC UNIT TEST SUITE');
console.log('================================================================\n');

function runKnowledgeSyncTests() {
  const localNode = new DistributedKnowledgeSyncEngine({ nodeId: 'Node-Alpha' });
  const remoteNode = new DistributedKnowledgeSyncEngine({ nodeId: 'Node-Beta' });

  console.log('--- 1. Exchange Knowledge Version Metadata ---');
  const localManifest = localNode.getMetadataManifest();
  assert(localManifest.length >= 2, 'Subtask 1: Local metadata manifest exported');
  assert(localManifest[0].hash !== undefined && localManifest[0].hash.length === 64, 'Subtask 1: Document SHA-256 hash included in manifest');

  console.log('\n--- 2. Compare Document Versions & Detect Outdated Knowledge ---');
  // Update document on remote node
  remoteNode.saveDocument({
    docId: 'SOP-CPR-2026',
    title: 'Offline CPR Protocol v2.0 (Updated)',
    version: 2,
    content: '1. Check responsiveness\n2. Call emergency mesh\n3. Perform 30 chest compressions at 100-120 bpm\n4. Give 2 rescue breaths\n5. Apply AED if available.',
    updatedAt: Date.now(),
    authorNodeId: 'Node-Beta'
  });

  const remoteManifest = remoteNode.getMetadataManifest();
  const diff = localNode.compareManifests(remoteManifest);

  assert(diff.outdatedLocal.length === 1, 'Subtask 2 & 3: Detected 1 outdated local document needing sync');
  assertEquals(diff.outdatedLocal[0].docId, 'SOP-CPR-2026', 'Subtask 3: Identified SOP-CPR-2026 as outdated');

  console.log('\n--- 3. Transfer Delta Updates & Verify File Integrity ---');
  const deltaPayload = remoteNode.generateDeltaPayload('SOP-CPR-2026');
  assertEquals(deltaPayload.version, 2, 'Subtask 4: Delta payload generated with version 2 content');

  const isValidIntegrity = localNode.verifyIntegrity(deltaPayload.content, deltaPayload.hash);
  assertEquals(isValidIntegrity, true, 'Subtask 5: SHA-256 checksum integrity verified');

  // Test Tampered Payload Integrity Rejection
  let tamperErr = null;
  try {
    localNode.syncRemoteDelta({ ...deltaPayload, content: 'Tampered malicious protocol content' });
  } catch (e) { tamperErr = e; }
  assert(tamperErr !== null, 'Subtask 5: Tampered delta payload checksum failed & rejected');

  console.log('\n--- 4. Resolve Conflict & Store Updated Knowledge Locally ---');
  const syncResult = localNode.syncRemoteDelta(deltaPayload);
  assertEquals(syncResult.synced, true, 'Subtask 6 & 7: Conflict resolved & updated document stored locally');
  assertEquals(localNode.localStore.get('SOP-CPR-2026').version, 2, 'Subtask 7: Local store updated to version 2');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runKnowledgeSyncTests();
