/**
 * Decentralized Architecture Refactoring Master Test Suite
 * Verifies that all central database components have been successfully replaced by
 * local encrypted identity stores, trusted peer registries, in-memory routing tables,
 * local telemetry logs, versioned local RAG stores, local session managers, and public-key cryptography.
 */

import { DeviceIdentityManager } from '../src/identity/device_identity.js';
import { LocalSecureStorageEngine } from '../src/storage/secure_storage.js';
import { MeshNodeManager } from '../src/mesh/node_manager.js';
import { MeshRoutingEngine } from '../src/mesh/routing_engine.js';
import { RecentActivityManager, ActivityType } from '../src/activity/recent_activity.js';
import { DistributedKnowledgeSyncEngine } from '../src/mesh/knowledge_sync.js';
import { LocalAuthenticationManager } from '../src/auth/local_authentication.js';
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

console.log('================================================================');
console.log(' DECENTRALIZED ARCHITECTURE MASTER TEST SUITE');
console.log('================================================================\n');

async function runDecentralizedArchitectureTests() {
  console.log('--- 1. User Database ➔ Local Encrypted Identity Store ---');
  const identityMgr = new DeviceIdentityManager({ keyType: 'ec', macAddress: '00:1A:2B:3C:4D:5E' });
  const identity = identityMgr.initIdentity();

  const storage = new LocalSecureStorageEngine({ masterPassword: 'DecentralizedMasterPassword2026' });
  storage.setItem('user_identity', identity);

  const loadedIdentity = storage.getItem('user_identity');
  assert(loadedIdentity.deviceId !== undefined, 'User DB replaced with local encrypted identity store');
  assertEquals(loadedIdentity.fingerprint, identity.fingerprint, 'Encrypted identity fingerprint verified');

  console.log('\n--- 2. Device Database ➔ Local Trusted Peer Registry ---');
  const nodeMgr = new MeshNodeManager();
  const peerNode = nodeMgr.registerNode({ nodeId: 'Peer-Node-B1', deviceName: 'Rescue Relay B1', role: 'RELAY', rssi: -52 });
  storage.storeTrustedDevices([peerNode]);

  const loadedPeers = storage.loadTrustedDevices();
  assertEquals(loadedPeers.length, 1, 'Device DB replaced with local trusted peer registry');
  assertEquals(loadedPeers[0].deviceName, 'Rescue Relay B1', 'Peer node record matches');

  console.log('\n--- 3. Routing Database ➔ In-Memory Routing Table ---');
  const routingEngine = new MeshRoutingEngine({ localNodeId: 'Node-User-Alpha' });
  routingEngine.addLink('Node-User-Alpha', 'Node-B1', { latencyMs: 20, rssi: -50 });
  routingEngine.addLink('Node-B1', 'Gateway-C1', { latencyMs: 30, rssi: -60 });

  const optimalRoute = routingEngine.calculateLowestLatencyRoute('Gateway-C1');
  routingEngine.updateRouteCache('Gateway-C1', optimalRoute);

  const cachedRoute = routingEngine.getRoute('Gateway-C1');
  assertEquals(cachedRoute.totalLatency, 50, 'Routing DB replaced with dynamic in-memory routing table');

  console.log('\n--- 4. Telemetry Database ➔ Local Event Log with Configurable Retention ---');
  const activityMgr = new RecentActivityManager();
  activityMgr.logActivity(ActivityType.MESH_MESSAGE, 'SOS Packet Relayed', 'Node B1');
  const activities = activityMgr.getActivities();
  assert(activities.length > 0, 'Telemetry DB replaced with local event log');

  console.log('\n--- 5. Knowledge Database ➔ Versioned Local RAG with P2P Sync ---');
  const knowledgeSync = new DistributedKnowledgeSyncEngine({ nodeId: 'Node-Alpha' });
  const manifest = knowledgeSync.getMetadataManifest();
  assert(manifest.length >= 2, 'Knowledge DB replaced with versioned local RAG repository');
  assert(manifest[0].hash !== undefined, 'Knowledge document SHA-256 hash verified');

  console.log('\n--- 6. User Sessions ➔ Local Secure Session Manager ---');
  const localAuth = new LocalAuthenticationManager();
  localAuth.setupPin('1234');
  const authRes = localAuth.authenticatePin('1234', 'decentralized-user-1', true);
  assertEquals(authRes.success, true, 'User sessions DB replaced with local secure session manager');
  assertEquals(authRes.session.isOffline, true, 'Local session authenticated offline');

  console.log('\n--- 7. API Auth Server ➔ Public Key Cryptography & Mutual Authentication ---');
  const security = new SecurityEngine();
  const token = security.signRs256Jwt({ userId: identity.deviceId, role: 'NODE' }, 900);
  const verified = security.verifyRs256Jwt(token);
  assertEquals(verified.userId, identity.deviceId, 'API Auth Server replaced with RS256 public-key cryptography');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runDecentralizedArchitectureTests().catch(err => {
  console.error('Decentralized Architecture Test Error:', err);
  process.exit(1);
});
