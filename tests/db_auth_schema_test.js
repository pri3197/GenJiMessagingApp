/**
 * Task 1.1.1: Design Authentication Database Test Suite
 */

import { AuthDatabaseEngine, AccountStatus, VerificationStatus, RoleType } from '../src/db/auth_entities.js';

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
console.log(' TASK 1.1.1: DESIGN AUTHENTICATION DATABASE TEST SUITE');
console.log('================================================================\n');

function runTask111Tests() {
  const db = new AuthDatabaseEngine();

  console.log('--- Subtask 8 & Seed Verification: Seed Initial Roles ---');
  assertEquals(db.roles.size, 3, 'Initial roles seeded (ADMIN, EMERGENCY_RESPONDER, STANDARD_USER)');
  assert(db.roles.has('role-admin'), 'ADMIN role present');
  assert(db.roles.has('role-responder'), 'EMERGENCY_RESPONDER role present');
  assert(db.roles.has('role-user'), 'STANDARD_USER role present');

  console.log('\n--- Subtask 1, 5, 6, 7: Create User Entity ---');
  const user = db.createUser({
    email: 'testuser@ble-mesh.org',
    phone_number: '+15551234567',
    full_name: 'Test Mesh User',
    account_status: AccountStatus.ACTIVE,
    verification_status: VerificationStatus.FULLY_VERIFIED,
    role_id: 'role-user'
  });

  assertEquals(user.email, 'testuser@ble-mesh.org', 'Subtask 1: User entity created with email');
  assertEquals(user.account_status, AccountStatus.ACTIVE, 'Subtask 5: Account status set to ACTIVE');
  assertEquals(user.verification_status, VerificationStatus.FULLY_VERIFIED, 'Subtask 6: Verification status set to FULLY_VERIFIED');
  assert(user.created_at !== undefined && user.updated_at !== undefined, 'Subtask 7: created_at and updated_at timestamps present');

  console.log('\n--- Subtask 2: Create Device Entity ---');
  const device = db.createDevice({
    device_name: 'Node-Rescue-B1',
    device_mac_address: '00:11:22:33:44:55',
    device_type: 'BLE_MESH_RELAY',
    mesh_public_key: '04:11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff'
  });

  assertEquals(device.device_mac_address, '00:11:22:33:44:55', 'Subtask 2: Device entity created with MAC address');
  assert(device.created_at !== undefined && device.updated_at !== undefined, 'Subtask 7: Device timestamps present');

  console.log('\n--- Subtask 3: Create User-Device Relationship ---');
  const rel = db.createUserDeviceRelationship(user.id, device.id, true);
  assertEquals(rel.user_id, user.id, 'Subtask 3: User-Device relationship created for user_id');
  assertEquals(rel.device_id, device.id, 'Subtask 3: User-Device relationship created for device_id');
  assertEquals(rel.is_primary, true, 'Subtask 3: Primary flag set to true');

  console.log('\n--- Subtask 4: Create Emergency Contact Entity ---');
  const contact = db.createEmergencyContact({
    user_id: user.id,
    contact_name: 'Primary Rescue HQ',
    contact_phone: '+15559111000',
    relationship: 'Dispatch Center',
    priority_order: 1
  });

  assertEquals(contact.contact_name, 'Primary Rescue HQ', 'Subtask 4: Emergency contact entity created');
  assertEquals(contact.priority_order, 1, 'Subtask 4: Priority order assigned');

  console.log('\n--- Subtask 10: Test Database Constraints ---');
  
  // 1. Duplicate email constraint
  let emailErr = null;
  try {
    db.createUser({ email: 'testuser@ble-mesh.org', full_name: 'Duplicate Email User' });
  } catch (err) { emailErr = err; }
  assert(emailErr !== null && emailErr.message.includes('CONSTRAINT_VIOLATION'), 'Subtask 10: Unique email constraint enforced');

  // 2. Duplicate MAC address constraint
  let macErr = null;
  try {
    db.createDevice({ device_mac_address: '00:11:22:33:44:55', mesh_public_key: '04:diff:key' });
  } catch (err) { macErr = err; }
  assert(macErr !== null && macErr.message.includes('CONSTRAINT_VIOLATION'), 'Subtask 10: Unique device MAC constraint enforced');

  // 3. Foreign key non-existent user constraint
  let fkErr = null;
  try {
    db.createUserDeviceRelationship('user-fake-id', device.id);
  } catch (err) { fkErr = err; }
  assert(fkErr !== null && fkErr.message.includes('FOREIGN_KEY_VIOLATION'), 'Subtask 10: User Foreign Key constraint enforced');

  // 4. Invalid Account Status Enum constraint
  let enumErr = null;
  try {
    db.createUser({ email: 'invalid@test.org', account_status: 'INVALID_STATUS' });
  } catch (err) { enumErr = err; }
  assert(enumErr !== null && enumErr.message.includes('CONSTRAINT_VIOLATION'), 'Subtask 10: Invalid enum value rejected');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runTask111Tests();
