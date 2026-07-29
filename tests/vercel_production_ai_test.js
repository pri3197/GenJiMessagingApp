/**
 * Live Vercel Production AI Features Test Suite
 * Connects directly to https://gen-ji-messaging-app.vercel.app/
 */

import https from 'https';

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

function makeHttpsGet(path) {
  return new Promise((resolve, reject) => {
    https.get(`https://gen-ji-messaging-app.vercel.app${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body || '{}') }));
    }).on('error', reject);
  });
}

function makeHttpsPost(path, payload = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = https.request({
      hostname: 'gen-ji-messaging-app.vercel.app',
      port: 443,
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
console.log(' LIVE VERCEL PRODUCTION AI FEATURES TEST SUITE');
console.log(' Target: https://gen-ji-messaging-app.vercel.app');
console.log('================================================================\n');

async function runVercelAiTests() {
  console.log('--- 1. Live Vercel Production Health & Telemetry ---');
  const healthRes = await makeHttpsGet('/api/health');
  assertEquals(healthRes.statusCode, 200, 'Live Vercel GET /api/health returns 200 OK');
  assertEquals(healthRes.body.status, 'HEALTHY', 'Vercel serverless platform status is HEALTHY');

  console.log('\n--- 2. Live Vercel AI Query Routing: Medical Triage ---');
  const medicalReq = await makeHttpsPost('/api/send-request', { query: 'Emergency Medical Triage Protocol' });
  assertEquals(medicalReq.statusCode, 200, 'Live Vercel POST /api/send-request returns 200 OK');
  assertEquals(medicalReq.body.query, 'Emergency Medical Triage Protocol', 'Query prompt echoed accurately');
  assert(medicalReq.body.answer !== undefined, 'AI Answer returned by Vercel serverless engine');
  assert(medicalReq.body.source !== undefined, 'Multi-Factor Decision routing source returned');

  console.log('\n--- 3. Live Vercel AI Query Routing: Offline Evacuation ---');
  const evacReq = await makeHttpsPost('/api/send-request', { query: 'Offline Disaster Evacuation Route' });
  assertEquals(evacReq.statusCode, 200, 'Live Vercel POST /api/send-request returns 200 OK');
  assert(evacReq.body.answer.length > 0, 'Offline RAG Evacuation Guide generated');

  console.log('\n--- 4. Live Vercel Sound Channel Telemetry ---');
  const soundRes = await makeHttpsGet('/api/sound/status');
  assertEquals(soundRes.statusCode, 200, 'Live Vercel GET /api/sound/status returns 200 OK');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runVercelAiTests().catch(err => {
  console.error('Vercel Production AI Test Error:', err);
  process.exit(1);
});
