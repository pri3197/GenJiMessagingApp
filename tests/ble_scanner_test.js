/**
 * Task 3.1.1: BLE Scanner Unit Test Suite
 */

import { BleScanner, BLE_ADAPTER_STATE, EMERGENCY_MESH_SERVICE_UUID } from '../src/mesh/ble_scanner.js';

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
console.log(' TASK 3.1.1: BLE SCANNER UNIT TEST SUITE');
console.log('================================================================\n');

function runBleScannerTests() {
  console.log('--- 1. Initialize BLE Adapter & Error Handling ---');
  const scanner = new BleScanner({ adapterState: BLE_ADAPTER_STATE.POWERED_ON });
  const initRes = scanner.initBleAdapter();
  assertEquals(initRes.state, BLE_ADAPTER_STATE.POWERED_ON, 'Subtask 1: BLE Adapter initialized cleanly');

  const offScanner = new BleScanner({ adapterState: BLE_ADAPTER_STATE.POWERED_OFF });
  let offErr = null;
  try { offScanner.initBleAdapter(); } catch (e) { offErr = e; }
  assert(offErr !== null && offErr.message.includes('powered off'), 'Subtask 9: Powered OFF adapter error caught');

  console.log('\n--- 2. Start & Stop Scanning ---');
  const scanStarted = scanner.startScan(5000);
  assertEquals(scanStarted, true, 'Subtask 2: Scanning started');
  assertEquals(scanner.isScanning, true, 'Subtask 2: Scanner state active');

  const scanStopped = scanner.stopScan();
  assertEquals(scanStopped, true, 'Subtask 3: Scanning stopped');
  assertEquals(scanner.isScanning, false, 'Subtask 3: Scanner state inactive');

  console.log('\n--- 3. Filter Emergency Devices & Parse Advertisements ---');
  // Non-emergency packet should be ignored
  const nonEmergencyAdv = { deviceId: 'BLE-BEACON-FITNESS', serviceUuids: ['0000180d-0000-1000-8000-00805f9b34fb'] };
  const nullParsed = scanner.parseAdvertisement(nonEmergencyAdv);
  assertEquals(nullParsed, null, 'Subtask 4: Non-emergency BLE devices filtered out');

  // Emergency Node packet
  const nodeAdv = {
    deviceId: 'Node-B1',
    deviceName: 'Rescue Relay B1',
    rssi: -58,
    serviceUuids: [EMERGENCY_MESH_SERVICE_UUID],
    manufacturerData: { role: 'NODE', battery: 90, hops: 1 }
  };
  const parsedNode = scanner.parseAdvertisement(nodeAdv);
  assertEquals(parsedNode.deviceId, 'Node-B1', 'Subtask 5 & 6: Emergency Peer Node advertisement parsed & discovered');
  assert(scanner.discoveredNodes.has('Node-B1'), 'Subtask 6: Peer node added to discoveredNodes Map');

  // Emergency Gateway packet
  const gatewayAdv = {
    deviceId: 'Gateway-C1',
    deviceName: 'Primary Gateway C1',
    rssi: -52,
    serviceUuids: [EMERGENCY_MESH_SERVICE_UUID],
    manufacturerData: { role: 'GATEWAY', battery: 95, wanOnline: true, hops: 1 }
  };
  const parsedGateway = scanner.parseAdvertisement(gatewayAdv);
  assertEquals(parsedGateway.role, 'GATEWAY', 'Subtask 5 & 7: Emergency Gateway advertisement parsed & discovered');
  assert(scanner.discoveredGateways.has('Gateway-C1'), 'Subtask 7: Gateway added to discoveredGateways Map');

  console.log('\n--- 4. Scan Timeout & BLE Error Handling ---');
  scanner.startScan(100);
  const timeoutRes = scanner.handleScanTimeout();
  assertEquals(timeoutRes.event, 'SCAN_TIMEOUT', 'Subtask 8: Scan window timeout handled cleanly');
  assertEquals(scanner.isScanning, false, 'Subtask 8: Scanner stopped after timeout');

  const errorLogged = scanner.handleBleError(new Error('BLE Radio Hardware Error'));
  assertEquals(errorLogged.message, 'BLE Radio Hardware Error', 'Subtask 9: BLE radio hardware error handled & logged');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runBleScannerTests();
