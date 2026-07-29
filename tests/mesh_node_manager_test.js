/**
 * Mesh Node Manager Unit Test Suite
 */

import { MeshNodeManager, NODE_STATUS } from '../src/mesh/node_manager.js';

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
console.log(' MESH NODE MANAGER UNIT TEST SUITE');
console.log('================================================================\n');

function runMeshNodeManagerTests() {
  const manager = new MeshNodeManager({ inactivityTimeoutMs: 1000 }); // 1s timeout for fast testing

  console.log('--- 1. Register Discovered Node ---');
  const node1 = manager.registerNode({
    nodeId: 'Node-B1',
    deviceName: 'Rescue Relay B1',
    role: 'RELAY',
    rssi: -55,
    battery: 85,
    latencyMs: 40,
    hops: 1
  });

  assertEquals(node1.nodeId, 'Node-B1', 'Subtask 1: Discovered node registered');
  assertEquals(node1.status, NODE_STATUS.ACTIVE, 'Subtask 1: Node status initially ACTIVE');

  console.log('\n--- 2. Update Node Status ---');
  const statusUpdated = manager.updateNodeStatus('Node-B1', NODE_STATUS.DEGRADED);
  assertEquals(statusUpdated, true, 'Subtask 2: Node status updated successfully');
  assertEquals(manager.nodes.get('Node-B1').status, NODE_STATUS.DEGRADED, 'Subtask 2: Node status changed to DEGRADED');

  console.log('\n--- 3. Heartbeat Processing & Telemetry Tracking (RSSI, Battery, Latency) ---');
  // Receive heartbeat updates
  manager.receiveHeartbeat('Node-B1', { rssi: -65, battery: 15, latencyMs: 60, hops: 2 });
  const nodeUpdated = manager.nodes.get('Node-B1');

  assertEquals(nodeUpdated.status, NODE_STATUS.ACTIVE, 'Subtask 4: Heartbeat restored status to ACTIVE');
  assertEquals(nodeUpdated.battery, 15, 'Subtask 6: Battery percentage tracked');
  assertEquals(nodeUpdated.isLowBattery, true, 'Subtask 6: Low battery alert (<=20%) triggered');

  // Test RSSI & Latency Moving Averages
  const avgRssi = manager.getAverageRssi('Node-B1');
  assertEquals(avgRssi, -60, 'Subtask 5: RSSI moving average calculated (-55 + -65) / 2 = -60');

  const avgLatency = manager.getAverageLatency('Node-B1');
  assertEquals(avgLatency, 50, 'Subtask 7: Latency moving average calculated (40 + 60) / 2 = 50');

  console.log('\n--- 4. Calculate Hop Count ---');
  const path = ['Node-User-Alpha', 'Node-B1', 'Gateway-C2', 'Node-B2'];
  const hopCount = manager.calculateHopCount(path);
  assertEquals(hopCount, 3, 'Subtask 8: Calculated 3-hop count from path array');

  console.log('\n--- 5. Remove Inactive Stale Nodes (Pruning) ---');
  // Register stale node
  manager.registerNode({ nodeId: 'Node-Stale-99', rssi: -90 });
  const staleNode = manager.nodes.get('Node-Stale-99');
  staleNode.lastHeartbeat = Date.now() - 2000; // Force heartbeat > 1000ms TTL

  const pruned = manager.pruneInactiveNodes(1000);
  assert(pruned.includes('Node-Stale-99'), 'Subtask 3: Inactive stale node pruned');
  assert(!manager.nodes.has('Node-Stale-99'), 'Subtask 3: Stale node removed from active nodes Map');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runMeshNodeManagerTests();
