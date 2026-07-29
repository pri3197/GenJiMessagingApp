/**
 * Story 1: Adaptive Bluetooth Mesh Communication
 * QA Subtask 4: Verify Node Join and Leave
 */

import { HeartbeatBeacon } from '../src/mesh/heartbeat.js';
import { GatewayDiscoveryPipeline } from '../src/mesh/gateway_selection.js';
import { MultipathFailoverManager } from '../src/mesh/multipath_failover.js';
import { BluetoothMeshService, MessageDeliveryStatus } from '../src/mesh/mesh_integration.js';

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
console.log(' QA SUBTASK 4: VERIFY NODE JOIN AND LEAVE');
console.log('================================================================\n');

async function runNodeJoinLeaveQA() {
  const pipeline = new GatewayDiscoveryPipeline({ ttlMs: 10000 });
  const failoverManager = new MultipathFailoverManager({ discoveryPipeline: pipeline, timeoutMs: 1500 });
  const meshService = new BluetoothMeshService({ failoverManager, localNodeId: 'Node-User-Alpha' });

  // Initial Node C1
  const gwC1 = new HeartbeatBeacon({ gatewayId: 'Gateway-C1', wanOnline: true, rssi: -60, battery: 80, wanLatency: 600, hops: 1 });
  pipeline.registerBeacon(gwC1.generateBeaconPayload());

  let currentRanked = pipeline.getRankedGateways();
  assertEquals(currentRanked.length, 1, 'Initial topology has 1 active gateway (Gateway-C1)');

  console.log('--- Test Scenario A: New Node Joins Mesh Network ---');
  // New Node C3 joins with high performance (battery: 99%, RSSI: -40 dBm, Latency: 200ms)
  const gwC3New = new HeartbeatBeacon({ gatewayId: 'Gateway-C3-Super', wanOnline: true, rssi: -40, battery: 99, wanLatency: 200, hops: 1 });
  
  // AC 4.1: New devices join successfully
  pipeline.registerBeacon(gwC3New.generateBeaconPayload());
  currentRanked = pipeline.getRankedGateways();
  assertEquals(currentRanked.length, 2, 'AC 4.1: New node [Gateway-C3-Super] successfully joined mesh network');

  // AC 4.2: Routes are updated automatically
  const elected = pipeline.selectElectedGateway();
  assertEquals(elected.gatewayId, 'Gateway-C3-Super', 'AC 4.2: Routing table updated automatically; Gateway-C3-Super elected top primary node');

  console.log('\n--- Test Scenario B: Node Leaves Mesh Network (Stale Pruning) ---');
  
  // Simulate Gateway-C3-Super leaving the mesh (heartbeat timestamp > 10,000ms old)
  const staleTimestamp = Date.now() - 15000;
  pipeline.gateways.get('Gateway-C3-Super').lastSeen = staleTimestamp;

  // Prune stale nodes
  const prunedCount = pipeline.pruneStaleGateways();
  assertEquals(prunedCount, 1, 'AC 4.3: Stale node [Gateway-C3-Super] pruned automatically after missing heartbeats');

  const postPruneRanked = pipeline.getRankedGateways();
  assertEquals(postPruneRanked.length, 1, 'AC 4.3: Topology reduced back to 1 active gateway');

  const reElected = pipeline.selectElectedGateway();
  assertEquals(reElected.gatewayId, 'Gateway-C1', 'AC 4.3: Route automatically updated to fallback node Gateway-C1');

  // AC 4.3: Network continues functioning after node removal
  const msgRes = await meshService.sendChatMessage('Node-B1', 'Post-node removal chat message', true);
  assertEquals(msgRes.status, MessageDeliveryStatus.DELIVERED, 'AC 4.3: Network continues functioning seamlessly after node removal');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runNodeJoinLeaveQA().catch(err => {
  console.error('QA Subtask 4 Test Error:', err);
  process.exit(1);
});
