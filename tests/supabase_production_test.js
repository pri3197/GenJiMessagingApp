/**
 * Live Supabase Production Server End-to-End Verification Test Suite
 * Connects directly to the live remote Supabase PostgreSQL database:
 * db.jxzmqfqirbljkqfluwut.supabase.co:5432
 */

import { execSync } from 'child_process';

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

const DB_URL = "postgresql://postgres:HPCPtDnqF581Soek@db.jxzmqfqirbljkqfluwut.supabase.co:5432/postgres";

function runRemoteQuery(sql) {
  const cmd = `npx supabase db query --db-url "${DB_URL}" "${sql.replace(/"/g, '\\"')}"`;
  const output = execSync(cmd, { encoding: 'utf8' });
  return output;
}

console.log('================================================================');
console.log(' LIVE SUPABASE PRODUCTION SERVER END-TO-END TEST SUITE');
console.log('================================================================\n');

function runSupabaseProductionTests() {
  console.log('--- 1. Verify Remote Production Tables ---');
  const tableCheckSql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';";
  const tablesOutput = runRemoteQuery(tableCheckSql);

  assert(tablesOutput.includes('roles'), 'Live Supabase DB contains roles table');
  assert(tablesOutput.includes('users'), 'Live Supabase DB contains users table');
  assert(tablesOutput.includes('devices'), 'Live Supabase DB contains devices table');
  assert(tablesOutput.includes('user_devices'), 'Live Supabase DB contains user_devices table');
  assert(tablesOutput.includes('emergency_contacts'), 'Live Supabase DB contains emergency_contacts table');

  console.log('\n--- 2. Verify Live Seed Data ---');
  const roleCountOutput = runRemoteQuery("SELECT count(*) FROM roles;");
  assert(roleCountOutput.includes('3'), 'Live Supabase DB contains 3 seeded roles (ADMIN, EMERGENCY_RESPONDER, STANDARD_USER)');

  const adminOutput = runRemoteQuery("SELECT email, full_name, account_status FROM users WHERE email = 'admin@ble-mesh.org';");
  assert(adminOutput.includes('admin@ble-mesh.org'), 'Seeded Admin User found in live Supabase DB');
  assert(adminOutput.includes('System Administrator'), 'Admin full_name verified in live Supabase DB');

  const deviceOutput = runRemoteQuery("SELECT device_name, device_mac_address FROM devices WHERE device_mac_address = '00:1A:2B:3C:4D:5E';");
  assert(deviceOutput.includes('Primary Gateway C1'), 'Seeded Primary Device found in live Supabase DB');

  const contactOutput = runRemoteQuery("SELECT contact_name, contact_phone FROM emergency_contacts WHERE contact_phone = '+18005559911';");
  assert(contactOutput.includes('District 4 Rescue Control'), 'Seeded Emergency Contact found in live Supabase DB');

  console.log('\n--- 3. Verify Live Production Insert, Update & Delete ---');
  const testUserEmail = `prod_test_${Date.now()}@ble-mesh.org`;
  const insertSql = `INSERT INTO users (email, full_name, account_status, verification_status) VALUES ('${testUserEmail}', 'Prod Test Node', 'ACTIVE', 'FULLY_VERIFIED');`;
  const insertOutput = runRemoteQuery(insertSql);
  assert(insertOutput.includes('INSERT 0 1'), 'Live production INSERT executed successfully');

  const queryInsertedSql = `SELECT email, full_name FROM users WHERE email = '${testUserEmail}';`;
  const queriedOutput = runRemoteQuery(queryInsertedSql);
  assert(queriedOutput.includes(testUserEmail), 'Inserted production user queried successfully');

  const deleteSql = `DELETE FROM users WHERE email = '${testUserEmail}';`;
  const deleteOutput = runRemoteQuery(deleteSql);
  assert(deleteOutput.includes('DELETE 1'), 'Test record cleaned up from live production DB');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runSupabaseProductionTests();
