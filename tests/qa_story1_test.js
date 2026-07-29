/**
 * Story 1: Adaptive Bluetooth Mesh Communication QA Automated Test Suite
 * QA Subtask 1: Verify Mesh Network Formation
 * QA Subtask 2: Verify Message Routing
 */

import { HeartbeatBeacon } from '../src/mesh/heartbeat.js';
import { GatewayDiscoveryPipeline, calculateGatewayScore } from '../src/mesh/gateway_selection.js';
import { RelayDeduplicationCache, MultipathFailoverManager } from '../src/mesh/multipath_failover.js';
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
console.log(' STORY 1: ADAPTIVE BLUETOOTH MESH COMMUNICATION (QA TEST SUITE)');
console.log('================================================================\n');

async function runStory1QA() {
  console.log('--- QA Subtask 1: Verify Mesh Network Formation ---');

  // Initialize Gateway Discovery & Mesh Topology Pipeline
  const pipeline = new GatewayDiscoveryPipeline();

  // Create Heartbeat Beacons for Mesh Nodes
  const nodeAlpha = new HeartbeatBeacon({ gatewayId: 'Node-User-Alpha', wanOnline: true, rssi: -45, battery: 98, wanLatency: 200, hops: 0 });
  const nodeB1 = new HeartbeatBeacon({ gatewayId: 'Node-B1-Relay', wanOnline: true, rssi: -55, battery: 88, wanLatency: 450, hops: 1 });
  const nodeB2 = new HeartbeatBeacon({ gatewayId: 'Node-B2-Medical', wanOnline: true, rssi: -68, battery: 72, wanLatency: 800, hops: 2 });
  const gatewayC1 = new HeartbeatBeacon({ gatewayId: 'Gateway-C1-Primary', wanOnline: true, rssi: -50, battery: 92, wanLatency: 350, hops: 1 });

  // 1. Discover Nearby Devices & Automatic Network Formation
  pipeline.registerBeacon(nodeAlpha.generateBeaconPayload());
  pipeline.registerBeacon(nodeB1.generateBeaconPayload());
  pipeline.registerBeacon(nodeB2.generateBeaconPayload());
  pipeline.registerBeacon(gatewayC1.generateBeaconPayload());

  const rankedTopology = pipeline.getRankedGateways();
  
  // AC 1.1: Nodes successfully discover nearby devices
  assertEquals(rankedTopology.length, 4, 'AC 1.1: 4 mesh nodes successfully discovered nearby');

  // AC 1.2: Mesh network formed automatically
  const elected = pipeline.selectElectedGateway();
  assert(elected !== null, 'AC 1.2: Mesh network topology automatically formed and elected optimal node');

  // AC 1.3: All connected nodes appear in network topology
  const discoveredNodeIds = rankedTopology.map(n => n.gatewayId);
  assert(discoveredNodeIds.includes('Node-User-Alpha'), 'AC 1.3: Node-User-Alpha present in topology');
  assert(discoveredNodeIds.includes('Node-B1-Relay'), 'AC 1.3: Node-B1-Relay present in topology');
  assert(discoveredNodeIds.includes('Node-B2-Medical'), 'AC 1.3: Node-B2-Medical present in topology');
  assert(discoveredNodeIds.includes('Gateway-C1-Primary'), 'AC 1.3: Gateway-C1-Primary present in topology');


  console.log('\n--- QA Subtask 2: Verify Message Routing ---');

  const failoverManager = new MultipathFailoverManager({ discoveryPipeline: pipeline, timeoutMs: 2500 });
  const meshService = new BluetoothMeshService({ failoverManager, localNodeId: 'Node-User-Alpha' });

  // AC 2.1: Messages reach destination through one or more intermediate hops
  const singleHopResult = await meshService.sendChatMessage('Node-B1-Relay', 'Direct 1-Hop Emergency Transmission', true);
  assertEquals(singleHopResult.status, MessageDeliveryStatus.DELIVERED, 'AC 2.1: Single-hop message routed successfully');

  const multiHopResult = await meshService.sendChatMessage('Node-B2-Medical', 'Multi-Hop 2-Hop Rescue Packet', true);
  assertEquals(multiHopResult.status, MessageDeliveryStatus.DELIVERED, 'AC 2.1: Multi-hop (2-Hop) message routed across intermediate node successfully');

  // AC 2.2: No duplicate messages are received
  const duplicatePacket = {
    packetId: 'PKT-QA-DUP-777',
    senderId: 'Node-B1-Relay',
    targetNode: 'Node-User-Alpha',
    payload: 'Emergency broadcast ping',
    timestamp: Date.now()
  };

  const rx1 = meshService.receiveChatMessage(duplicatePacket);
  const rx2 = meshService.receiveChatMessage(duplicatePacket); // Duplicate broadcast
  const rx3 = meshService.receiveChatMessage(duplicatePacket); // Duplicate broadcast

  assert(rx1 !== null, 'AC 2.2: Initial packet accepted cleanly');
  assertEquals(rx2, null, 'AC 2.2: First duplicate packet dropped by deduplication cache (0 duplicate delivered)');
  assertEquals(rx3, null, 'AC 2.2: Second duplicate packet dropped by deduplication cache');

  // AC 2.3: Delivery success rate is within expected limits (10/10 = 100%)
  let successCount = 0;
  const totalTestPings = 10;

  for (let i = 0; i < totalTestPings; i++) {
    const res = await meshService.sendChatMessage(`Node-B1-Relay`, `Ping test ${i}`, true);
    if (res.status === MessageDeliveryStatus.DELIVERED) successCount++;
  }

  const successRatePct = (successCount / totalTestPings) * 100;
  assertEquals(successRatePct, 100, 'AC 2.3: Delivery success rate is 100% under nominal mesh conditions');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runStory1QA().catch(err => {
  console.error('Story 1 QA Test Suite Error:', err);
  process.exit(1);
});
