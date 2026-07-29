/**
 * Task 1.1.3: User Login API Unit Test Suite
 */

import { AuthDatabaseEngine, AccountStatus } from '../src/db/auth_entities.js';
import { RegistrationService } from '../src/auth/registration_service.js';
import { LoginService } from '../src/auth/login_service.js';

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
console.log(' TASK 1.1.3: USER LOGIN API UNIT TEST SUITE');
console.log('================================================================\n');

function runLoginUnitTests() {
  const authDb = new AuthDatabaseEngine();
  const regService = new RegistrationService(authDb);
  const loginService = new LoginService(authDb);

  // Register an active user for testing login
  const regRes = regService.registerUser({
    email: 'login_user@ble-mesh.org',
    password: 'ValidPassword123!',
    full_name: 'Login Test User'
  });

  // Activate user account
  const storedUser = authDb.users.get(regRes.user.id);
  storedUser.account_status = AccountStatus.ACTIVE;

  console.log('--- 1. Valid Login & Token Generation ---');
  const loginRes = loginService.loginUser({
    email: 'login_user@ble-mesh.org',
    password: 'ValidPassword123!'
  });

  assertEquals(loginRes.success, true, 'Login succeeds for valid credentials');
  assertEquals(loginRes.tokenType, 'Bearer', 'Token type is Bearer');
  assert(loginRes.accessToken !== undefined && loginRes.accessToken.split('.').length === 3, 'Valid 3-part JWT access token generated');
  assert(loginRes.refreshToken !== undefined && loginRes.refreshToken.length === 64, '64-char refresh token generated');
  assert(loginService.refreshTokens.has(loginRes.refreshToken), 'Refresh token stored in server store');

  console.log('\n--- 2. Invalid Credentials (Wrong Password / Unknown Email) ---');
  let invalidPwdErr = null;
  try {
    loginService.loginUser({ email: 'login_user@ble-mesh.org', password: 'WrongPassword123!' });
  } catch (e) { invalidPwdErr = e; }
  assertEquals(invalidPwdErr.statusCode, 401, 'Wrong password rejected with 401 Unauthorized status');

  let unknownEmailErr = null;
  try {
    loginService.loginUser({ email: 'unknown@ble-mesh.org', password: 'ValidPassword123!' });
  } catch (e) { unknownEmailErr = e; }
  assertEquals(unknownEmailErr.statusCode, 401, 'Unknown email rejected with 401 Unauthorized status');

  console.log('\n--- 3. Account Status Verification (Suspended Account) ---');
  storedUser.account_status = AccountStatus.SUSPENDED;
  let suspendedErr = null;
  try {
    loginService.loginUser({ email: 'login_user@ble-mesh.org', password: 'ValidPassword123!' });
  } catch (e) { suspendedErr = e; }
  assertEquals(suspendedErr.statusCode, 403, 'Suspended account login rejected with 403 Forbidden status');

  console.log('\n--- 4. Audit Logging Verification ---');
  const logs = loginService.auditLogs;
  assert(logs.length >= 3, 'Audit logs recorded for both successful and failed attempts');
  assertEquals(logs[0].status, 'FAILED_SUSPENDED_ACCOUNT', 'Latest audit log reflects suspended account failure');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runLoginUnitTests();
