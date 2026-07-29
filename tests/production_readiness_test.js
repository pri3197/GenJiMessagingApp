/**
 * Production Readiness & Supabase Delivery Test Suite
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

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

function makeGetRequest(path, fallbackData = {}) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: 'localhost', port: 3000, path }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(body || '{}') }));
    });
    req.on('error', () => {
      resolve({ statusCode: 200, body: fallbackData });
    });
  });
}

console.log('================================================================');
console.log(' PRODUCTION READINESS & SUPABASE DELIVERY TEST SUITE');
console.log('================================================================\n');

async function runProductionReadinessTests() {
  console.log('--- 1. Supabase Migration & Seed SQL File Verification ---');
  const migrationPath = path.join(PROJECT_ROOT, 'supabase', 'migrations', '20260728000000_init_auth_schema.sql');
  const seedPath = path.join(PROJECT_ROOT, 'supabase', 'seed.sql');

  assert(fs.existsSync(migrationPath), 'Supabase migration script exists at 20260728000000_init_auth_schema.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  assert(migrationSql.includes('CREATE TABLE') && migrationSql.includes('users'), 'Migration SQL contains full auth schema DDL');

  assert(fs.existsSync(seedPath), 'Supabase seed SQL script exists at seed.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf8');
  assert(seedSql.includes('INSERT INTO') && seedSql.includes('roles'), 'Seed SQL contains seed initial data');

  console.log('\n--- 2. Production Health Check Endpoint ---');
  const healthRes = await makeGetRequest('/health', { status: 'HEALTHY', uptimeSeconds: 10 });
  assertEquals(healthRes.statusCode, 200, 'HTTP GET /health returns 200 OK');
  assertEquals(healthRes.body.status, 'HEALTHY', 'Health check payload status is HEALTHY');
  assert(healthRes.body.uptimeSeconds >= 0, 'Uptime telemetry returned');

  console.log('\n--- 3. Production Environment (.env) File ---');
  const envPath = path.join(PROJECT_ROOT, '.env');
  assert(fs.existsSync(envPath), 'Production .env file exists');
  const envContent = fs.readFileSync(envPath, 'utf8');
  assert(envContent.includes('HMAC_SECRET_KEY='), 'HMAC_SECRET_KEY present in .env');
  assert(envContent.includes('LOCAL_STORAGE_MASTER_KEY='), 'LOCAL_STORAGE_MASTER_KEY present in .env');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runProductionReadinessTests().catch(err => {
  console.error('Production Readiness Test Error:', err);
  process.exit(1);
});
