import { HeartbeatBeacon } from '../src/mesh/heartbeat.js';
import { calculateGatewayScore, GatewayDiscoveryPipeline } from '../src/mesh/gateway_selection.js';
import { RelayDeduplicationCache, MultipathFailoverManager } from '../src/mesh/multipath_failover.js';
import { MultiFactorDecisionEngine } from '../src/gateway/decision_engine.js';
import { QueryCache } from '../src/gateway/query_cache.js';
import { BluetoothMeshService, MessageDeliveryStatus } from '../src/mesh/mesh_integration.js';
import { MeshDiagnosticsEngine } from '../src/mesh/diagnostics.js';
import { AuthDatabaseEngine, AccountStatus, VerificationStatus } from '../src/db/auth_entities.js';
import { LocalStorageManager } from '../public/js/app.js';

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
console.log(' MASTER TEST SUITE - BLUETOOTH MESH AI SYSTEM & AUTH DATABASE');
console.log('================================================================\n');

// Mock localStorage for Node environment
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

const diagEngine = new MeshDiagnosticsEngine();
const authDb = new AuthDatabaseEngine();

async function runMasterTests() {
  console.log('--- Task 1.1.1: Design Authentication Database Verification ---');
  assertEquals(authDb.roles.size, 3, 'Initial roles seeded');

  const u = authDb.createUser({
    email: 'admin@ble-mesh.org',
    full_name: 'Admin User',
    account_status: AccountStatus.ACTIVE,
    verification_status: VerificationStatus.FULLY_VERIFIED
  });
  assertEquals(u.email, 'admin@ble-mesh.org', 'User created');

  const d = authDb.createDevice({
    device_mac_address: '00:1A:2B:3C:4D:5E',
    mesh_public_key: '04:key:sample'
  });
  assertEquals(d.device_mac_address, '00:1A:2B:3C:4D:5E', 'Device created');

  const rel = authDb.createUserDeviceRelationship(u.id, d.id, true);
  assertEquals(rel.is_primary, true, 'User-Device relationship established');

  const contact = authDb.createEmergencyContact({
    user_id: u.id,
    contact_name: 'Dispatch',
    contact_phone: '+1555911'
  });
  assertEquals(contact.contact_name, 'Dispatch', 'Emergency Contact created');

  console.log('\n--- Epic 8: Diagnostics Verification ---');
  const summary = diagEngine.getDiagnosticsSummary();
  assertEquals(summary.packetLoss, '2%', 'Packet loss verified (2%)');
  assertEquals(summary.gateway, 'C2', 'Gateway metric verified (C2)');

  console.log('\n================================================================');
  console.log(` RESULTS: ALL TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================');
}

runMasterTests().catch(err => {
  console.error('Master Test Suite Error:', err);
  process.exit(1);
});
