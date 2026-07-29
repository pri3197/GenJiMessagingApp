/**
 * Task 1.1.2: User Registration API Unit Test Suite
 */

import { RegistrationService } from '../src/auth/registration_service.js';
import { AuthDatabaseEngine, AccountStatus, VerificationStatus } from '../src/db/auth_entities.js';

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
console.log(' TASK 1.1.2: USER REGISTRATION API UNIT TEST SUITE');
console.log('================================================================\n');

function runRegistrationUnitTests() {
  const authDb = new AuthDatabaseEngine();
  const service = new RegistrationService(authDb);

  console.log('--- 1. Email Format Validation ---');
  let invalidEmailErr = null;
  try { service.validateEmail('invalid-email-address'); } catch (e) { invalidEmailErr = e; }
  assertEquals(invalidEmailErr.statusCode, 400, 'Invalid email format rejected with 400 status');

  console.log('\n--- 2. Mobile Number Validation ---');
  let invalidPhoneErr = null;
  try { service.validateMobileNumber('12345'); } catch (e) { invalidPhoneErr = e; }
  assertEquals(invalidPhoneErr.statusCode, 400, 'Invalid mobile number rejected with 400 status');

  console.log('\n--- 3. Password Policy Validation ---');
  let shortPwdErr = null;
  try { service.validatePasswordPolicy('Pass1!'); } catch (e) { shortPwdErr = e; }
  assertEquals(shortPwdErr.statusCode, 400, 'Short password (<8 chars) rejected with 400 status');

  let weakPwdErr = null;
  try { service.validatePasswordPolicy('password123'); } catch (e) { weakPwdErr = e; }
  assertEquals(weakPwdErr.statusCode, 400, 'Password missing uppercase & special char rejected with 400 status');

  console.log('\n--- 4. Valid Registration Flow & Token Generation ---');
  const validPayload = {
    email: 'user1@ble-mesh.org',
    phone_number: '+15559876543',
    password: 'SecurePassword123!',
    full_name: 'Alice Mesh'
  };

  const response = service.registerUser(validPayload);
  assertEquals(response.success, true, 'User registration succeeds for valid payload');
  assertEquals(response.user.email, 'user1@ble-mesh.org', 'Registered email matches');
  assertEquals(response.user.account_status, AccountStatus.PENDING_VERIFICATION, 'Initial account status is PENDING_VERIFICATION');
  assertEquals(response.user.verification_status, VerificationStatus.UNVERIFIED, 'Initial verification status is UNVERIFIED');
  assert(response.verificationToken !== undefined && response.verificationToken.length === 64, '64-char crypto verification token generated');

  console.log('\n--- 5. Duplicate Account Prevention ---');
  let dupEmailErr = null;
  try {
    service.registerUser({
      email: 'user1@ble-mesh.org',
      password: 'AnotherPassword123!',
      full_name: 'Duplicate Alice'
    });
  } catch (e) { dupEmailErr = e; }
  assertEquals(dupEmailErr.statusCode, 409, 'Duplicate email registration rejected with 409 Conflict status');

  console.log('\n--- 6. Password Encryption Verification ---');
  const storedUser = authDb.users.get(response.user.id);
  assert(storedUser.password_hash !== undefined && storedUser.password_hash !== 'SecurePassword123!', 'Password stored as PBKDF2 hash, not plaintext');
  assert(storedUser.password_salt !== undefined, 'Password salt stored');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runRegistrationUnitTests();
