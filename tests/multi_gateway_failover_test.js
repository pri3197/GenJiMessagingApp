/**
 * Multi-Gateway Failover Unit Test Suite
 */

import { MultipathFailoverManager } from '../src/mesh/multipath_failover.js';
import { GatewayDiscoveryPipeline } from '../src/mesh/gateway_selection.js';

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
console.log(' MULTI-GATEWAY FAILOVER UNIT TEST SUITE');
console.log('================================================================\n');

async function runMultiGatewayFailoverTests() {
  const pipeline = new GatewayDiscoveryPipeline();
  pipeline.registerBeacon({ gatewayId: 'Gateway-C1', metrics: { wanOnline: true, rssi: -50, battery: 90, hops: 1 } });
  pipeline.registerBeacon({ gatewayId: 'Gateway-C2', metrics: { wanOnline: true, rssi: -70, battery: 75, hops: 2 } });

  const failover = new MultipathFailoverManager({ discoveryPipeline: pipeline, timeoutMs: 2500, preferredGatewayId: 'Gateway-C1' });

  console.log('--- 1. Detect Gateway Timeout ---');
  assert(failover.detectGatewayTimeout('Gateway-C1', 2600) === true, 'Subtask 1: Gateway timeout (2600ms >= 2500ms) detected');
  assert(failover.detectGatewayTimeout('Gateway-C1', 1200) === false, 'Subtask 1: Gateway response within threshold (1200ms < 2500ms) valid');

  console.log('\n--- 2. Select Backup Gateway ---');
  const backupGw = failover.selectBackupGateway('Gateway-C1');
  assertEquals(backupGw.gatewayId, 'Gateway-C2', 'Subtask 2: Selected Gateway-C2 as backup gateway');

  console.log('\n--- 3. Switch Active Route ---');
  const switchRes = failover.switchActiveGatewayRoute('Gateway-C2');
  assertEquals(switchRes.activeGatewayId, 'Gateway-C2', 'Subtask 3: Active gateway route switched to Gateway-C2');

  console.log('\n--- 4. Verify Connection ---');
  const mockProbeFn = async (gwId, pkt) => ({ status: 'PONG' });
  const connRes = await failover.verifyGatewayConnection('Gateway-C2', mockProbeFn);
  assertEquals(connRes.verified, true, 'Subtask 4: Backup gateway connection verified via probe ping');

  console.log('\n--- 5. Restore Preferred Gateway ---');
  const restoreRes = failover.restorePreferredGateway('Gateway-C1');
  assertEquals(restoreRes.restored, true, 'Subtask 5: Primary preferred gateway Gateway-C1 restored');
  assertEquals(failover.activeGatewayId, 'Gateway-C1', 'Subtask 5: Active gateway updated to Gateway-C1');

  console.log('\n--- 6. Prevent Routing Loops ---');
  const loopPath = ['Node-User-Alpha', 'Node-B1', 'Node-B2', 'Node-B1', 'Gateway-C1'];
  const loopRes = failover.preventRoutingLoops(loopPath);
  assertEquals(loopRes.hasLoop, true, 'Subtask 6: Routing loop detected in multi-hop path');
  assertEquals(loopRes.valid, false, 'Subtask 6: Loop path marked invalid');

  const validPath = ['Node-User-Alpha', 'Node-B1', 'Gateway-C1'];
  const validRes = failover.preventRoutingLoops(validPath);
  assertEquals(validRes.hasLoop, false, 'Subtask 6: Clean path with zero loops validated');

  console.log('\n--- 7. Full Failover Execution Test ---');
  const mockFailoverSendFn = async (targetGwId, pkt) => {
    if (targetGwId === 'Gateway-C1') throw new Error('PRIMARY_RF_JAMMED_TIMEOUT');
    return { status: 'OK', processedBy: targetGwId };
  };

  const failoverExecRes = await failover.sendRequestWithFailover({ packetId: `PKT-${Date.now()}`, payload: 'Failover Test' }, mockFailoverSendFn);
  assertEquals(failoverExecRes.status, 'DELIVERED_FAILOVER', 'Subtask 7: Request delivered via failover backup gateway');
  assertEquals(failoverExecRes.deliveredGatewayId, 'Gateway-C2', 'Subtask 7: Delivered by Gateway-C2');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runMultiGatewayFailoverTests().catch(err => {
  console.error('Multi-Gateway Failover Test Error:', err);
  process.exit(1);
});
