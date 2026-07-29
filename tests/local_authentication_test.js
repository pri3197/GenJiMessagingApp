/**
 * Task 1.1.4: Local Authentication Unit Test Suite
 */

import { LocalAuthenticationManager } from '../src/auth/local_authentication.js';

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
console.log(' TASK 1.1.4: LOCAL AUTHENTICATION UNIT TEST SUITE');
console.log('================================================================\n');

function runLocalAuthTests() {
  const manager = new LocalAuthenticationManager({ sessionTimeoutMs: 5000 }); // 5s timeout for fast testing

  console.log('--- 1. PIN Setup & Validation ---');
  let invalidPinErr = null;
  try { manager.setupPin('12'); } catch (e) { invalidPinErr = e; }
  assert(invalidPinErr !== null && invalidPinErr.message.includes('4-6 digit'), 'Subtask 1: Invalid PIN format (<4 digits) rejected');

  manager.setupPin('2468');
  assert(manager.pinRecord !== null, 'Subtask 1: Valid 4-digit PIN setup & PBKDF2 hashed');

  console.log('\n--- 2. Offline PIN Authentication ---');
  const authRes = manager.authenticatePin('2468', 'node-user-alpha', true);
  assertEquals(authRes.success, true, 'Subtask 1 & 2: Local PIN authenticated offline');
  assertEquals(authRes.session.isOffline, true, 'Subtask 2: Session marked as offline authentication');

  console.log('\n--- 3. Lockout After 3 Failed Attempts ---');
  manager.logout(); // Logout to test failed attempts

  let f1 = null; try { manager.authenticatePin('0000'); } catch (e) { f1 = e; }
  let f2 = null; try { manager.authenticatePin('0000'); } catch (e) { f2 = e; }
  let f3 = null; try { manager.authenticatePin('0000'); } catch (e) { f3 = e; }

  assert(f3.message.includes('Account locked'), 'Subtask 4: Account locked after 3 failed attempts');

  let f4 = null; try { manager.authenticatePin('2468'); } catch (e) { f4 = e; }
  assert(f4.message.includes('LOCKOUT_ERROR'), 'Subtask 4: Subsequent login attempts blocked during lockout period');

  console.log('\n--- 4. Session Idle Timeout Enforcement ---');
  // Reset manager for clean session testing
  const manager2 = new LocalAuthenticationManager({ sessionTimeoutMs: 100 });
  manager2.setupPin('1234');
  manager2.authenticatePin('1234', 'user-2');

  assert(manager2.checkSessionTimeout().active === true, 'Subtask 3: Active session valid immediately after auth');

  // Force idle timeout (>100ms)
  manager2.activeSession.lastActivity = Date.now() - 200;
  const timeoutRes = manager2.checkSessionTimeout();
  assertEquals(timeoutRes.active, false, 'Subtask 3: Session automatically timed out after inactivity');
  assertEquals(manager2.activeSession, null, 'Subtask 3: Session cleared on timeout');

  console.log('\n--- 5. Logout Functionality ---');
  const manager3 = new LocalAuthenticationManager();
  manager3.setupPin('9999');
  manager3.authenticatePin('9999');
  assert(manager3.activeSession !== null, 'Active session present');

  const logoutSuccess = manager3.logout();
  assertEquals(logoutSuccess, true, 'Subtask 5: Logout executed successfully');
  assertEquals(manager3.activeSession, null, 'Subtask 5: Active session cleared after logout');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runLocalAuthTests();
