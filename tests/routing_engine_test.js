/**
 * Task 3.1.4: Routing Engine Unit Test Suite
 */

import { MeshRoutingEngine } from '../src/mesh/routing_engine.js';

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
console.log(' TASK 3.1.4: ROUTING ENGINE UNIT TEST SUITE');
console.log('================================================================\n');

function runRoutingEngineTests() {
  const engine = new MeshRoutingEngine({ localNodeId: 'Node-User-Alpha', routeTtlMs: 1000 });

  // Build Topology Graph:
  // Node-User-Alpha --(30ms)--> Node-B1 --(40ms)--> Gateway-C1 (2 Hops, 70ms)
  // Node-User-Alpha --(500ms)--> Gateway-C1 (1 Hop, 500ms)
  // Node-B1 --(20ms)--> Node-B2 --(10ms)--> Gateway-C1 (3 Hops, 60ms)

  engine.addLink('Node-User-Alpha', 'Node-B1', { latencyMs: 30, rssi: -50 });
  engine.addLink('Node-B1', 'Gateway-C1', { latencyMs: 40, rssi: -60 });

  engine.addLink('Node-User-Alpha', 'Gateway-C1', { latencyMs: 500, rssi: -85 }); // Direct but high latency

  engine.addLink('Node-B1', 'Node-B2', { latencyMs: 20, rssi: -55 });
  engine.addLink('Node-B2', 'Gateway-C1', { latencyMs: 10, rssi: -50 });

  console.log('--- 1. Discover Available Routes ---');
  const available = engine.discoverRoutes('Gateway-C1');
  assert(available.length >= 3, 'Subtask 1: Discovered candidate multi-hop routes');

  console.log('\n--- 2. Calculate Shortest Route (Min Hops) ---');
  const shortest = engine.calculateShortestRoute('Gateway-C1');
  assertEquals(shortest.hops, 1, 'Subtask 2: Shortest route has 1 hop (Direct link)');
  assertEquals(shortest.path.join('->'), 'Node-User-Alpha->Gateway-C1', 'Subtask 2: Shortest route path verified');

  console.log('\n--- 3. Calculate Lowest-Latency Route ---');
  const lowestLatency = engine.calculateLowestLatencyRoute('Gateway-C1');
  assertEquals(lowestLatency.totalLatency, 60, 'Subtask 3: Lowest latency route has 60ms total latency (3-hop fast path)');
  assertEquals(lowestLatency.path.join('->'), 'Node-User-Alpha->Node-B1->Node-B2->Gateway-C1', 'Subtask 3: Lowest-latency route path verified');

  console.log('\n--- 4. Maintain Routing Table & Update Route Cache ---');
  engine.updateRouteCache('Gateway-C1', lowestLatency);
  const cachedRoute = engine.getRoute('Gateway-C1');
  assert(cachedRoute !== null, 'Subtask 4 & 5: Route cached and retrieved from memory table');
  assertEquals(cachedRoute.totalLatency, 60, 'Subtask 5: Cached route payload verified');

  console.log('\n--- 5. Remove Expired Routes ---');
  cachedRoute.cachedAt = Date.now() - 2000; // Force route cachedAt past 1000ms TTL
  const expiredCount = engine.removeExpiredRoutes(1000);
  assertEquals(expiredCount, 1, 'Subtask 6: Expired route purged from cache');
  assertEquals(engine.getRoute('Gateway-C1'), null, 'Subtask 6: Expired route no longer in memory table');

  console.log('\n--- 6. Recalculate Routes After Topology Changes ---');
  // Remove Node-B2 (simulate failure)
  engine.removeNode('Node-B2');
  const newLowestLatency = engine.calculateLowestLatencyRoute('Gateway-C1');
  assertEquals(newLowestLatency.totalLatency, 70, 'Subtask 7: Recalculated optimal route (70ms) after Node-B2 failure');
  assertEquals(newLowestLatency.path.join('->'), 'Node-User-Alpha->Node-B1->Gateway-C1', 'Subtask 7: Recalculated path updated');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runRoutingEngineTests();
