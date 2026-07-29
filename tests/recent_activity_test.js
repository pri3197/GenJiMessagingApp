/**
 * Task 2.1.5: Recent Activity Unit & Integration Test Suite
 */

import http from 'http';
import { RecentActivityManager, ActivityType } from '../src/activity/recent_activity.js';

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

function makeGetRequest(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 3000, path }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body || '{}') }));
    }).on('error', reject);
  });
}

function makePostRequest(path, payload = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body || '{}') }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

console.log('================================================================');
console.log(' TASK 2.1.5: RECENT ACTIVITY TEST SUITE');
console.log('================================================================\n');

async function runRecentActivityTests() {
  const manager = new RecentActivityManager();

  console.log('--- 1. Display Recent AI Queries ---');
  manager.logActivity(ActivityType.AI_QUERY, 'Triage prompt for hypothermia', '⚡ Edge Local RAG');
  const aiList = manager.getActivities(ActivityType.AI_QUERY);
  assert(aiList.length >= 2, 'Subtask 1: Displayed recent AI queries feed');
  assertEquals(aiList[0].title, 'Triage prompt for hypothermia', 'Subtask 1: AI Query entry title verified');

  console.log('\n--- 2. Display Recent Mesh Messages ---');
  manager.logActivity(ActivityType.MESH_MESSAGE, 'SOS Beacon broadcast', 'Node B2 - Medical Response');
  const meshList = manager.getActivities(ActivityType.MESH_MESSAGE);
  assert(meshList.length >= 2, 'Subtask 2: Displayed recent mesh messages feed');
  assertEquals(meshList[0].title, 'SOS Beacon broadcast', 'Subtask 2: Mesh message entry verified');

  console.log('\n--- 3. Display Gateway Changes ---');
  manager.logActivity(ActivityType.GATEWAY_CHANGE, 'Failover switched to Gateway C2', 'Latency: 830ms');
  const gwList = manager.getActivities(ActivityType.GATEWAY_CHANGE);
  assert(gwList.length >= 2, 'Subtask 3: Displayed gateway failover changes log');
  assertEquals(gwList[0].title, 'Failover switched to Gateway C2', 'Subtask 3: Gateway change entry verified');

  console.log('\n--- 4. Display Synchronisation Events ---');
  manager.logActivity(ActivityType.SYNC_EVENT, 'P2P Sync complete with Node B1', '5 delta messages integrated');
  const syncList = manager.getActivities(ActivityType.SYNC_EVENT);
  assert(syncList.length >= 2, 'Subtask 4: Displayed synchronisation events log');
  assertEquals(syncList[0].title, 'P2P Sync complete with Node B1', 'Subtask 4: Sync event entry verified');

  console.log('\n--- 5. Clear Activity History ---');
  manager.clearHistory();
  assertEquals(manager.getActivities().length, 0, 'Subtask 5: Activity history cleared successfully');

  console.log('\n--- 6. HTTP API Integration Testing ---');
  const getRes = await makeGetRequest('/api/activity/list?filter=ALL');
  assertEquals(getRes.statusCode, 200, 'Subtask 6: GET /api/activity/list returns 200 OK');
  assert(getRes.body.activities !== undefined, 'Subtask 6: Response payload contains activities array');

  const clearRes = await makePostRequest('/api/activity/clear');
  assertEquals(clearRes.statusCode, 200, 'Subtask 6: POST /api/activity/clear returns 200 OK');
  assertEquals(clearRes.body.success, true, 'Subtask 6: Activity history cleared over HTTP API');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runRecentActivityTests().catch(err => {
  console.error('Recent Activity Test Error:', err);
  process.exit(1);
});
