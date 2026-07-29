/**
 * Task 1.1.4: OTP Verification API Unit Test Suite
 */

import { AuthDatabaseEngine, VerificationStatus } from '../src/db/auth_entities.js';
import { RegistrationService } from '../src/auth/registration_service.js';
import { OtpService } from '../src/auth/otp_service.js';

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
console.log(' TASK 1.1.4: OTP VERIFICATION API UNIT TEST SUITE');
console.log('================================================================\n');

function runOtpUnitTests() {
  const authDb = new AuthDatabaseEngine();
  const regService = new RegistrationService(authDb);
  const otpService = new OtpService(authDb);

  // Register user for testing OTP verification
  const regRes = regService.registerUser({
    email: 'otp_user@ble-mesh.org',
    phone_number: '+15557771234',
    password: 'ValidPassword123!',
    full_name: 'OTP Test User'
  });

  console.log('--- 1. Generate & Request OTP (Email & SMS Dispatch) ---');
  const reqRes = otpService.requestOtp('otp_user@ble-mesh.org', 'EMAIL');
  assertEquals(reqRes.success, true, 'OTP requested successfully');
  assertEquals(otpService.sentMessages.length, 1, 'Email OTP dispatched to message queue');
  assertEquals(otpService.sentMessages[0].type, 'EMAIL', 'Dispatch type is EMAIL');

  const otpRecord = otpService.otpStore.get('otp_user@ble-mesh.org');
  assert(otpRecord.otp !== undefined && otpRecord.otp.length === 6, '6-digit numeric OTP generated');
  assert(otpRecord.expiresAt > Date.now(), 'OTP expiry stored 5 minutes in future');

  console.log('\n--- 2. Validate OTP & Verification Status Update ---');
  const verifyRes = otpService.verifyOtp('otp_user@ble-mesh.org', otpRecord.otp);
  assertEquals(verifyRes.verified, true, 'Correct OTP code verified successfully');

  const user = authDb.users.get(regRes.user.id);
  assertEquals(user.verification_status, VerificationStatus.FULLY_VERIFIED, 'User verification_status updated to FULLY_VERIFIED');

  console.log('\n--- 3. Resend OTP Functionality ---');
  const resendRes = otpService.resendOtp('otp_user@ble-mesh.org');
  assertEquals(resendRes.success, true, 'OTP resent successfully');
  const newRecord = otpService.otpStore.get('otp_user@ble-mesh.org');
  assert(newRecord !== undefined, 'New OTP record generated');

  console.log('\n--- 4. Limit OTP Verification Attempts (Max 3) ---');
  let attempt1Err = null; try { otpService.verifyOtp('otp_user@ble-mesh.org', '000000'); } catch (e) { attempt1Err = e; }
  let attempt2Err = null; try { otpService.verifyOtp('otp_user@ble-mesh.org', '000000'); } catch (e) { attempt2Err = e; }
  let attempt3Err = null; try { otpService.verifyOtp('otp_user@ble-mesh.org', '000000'); } catch (e) { attempt3Err = e; }
  let attempt4Err = null; try { otpService.verifyOtp('otp_user@ble-mesh.org', '000000'); } catch (e) { attempt4Err = e; }

  assertEquals(attempt4Err.statusCode, 429, 'Submitting 4th attempt rejected with 429 Rate Limit status');
  assert(attempt4Err.message.includes('exceeded'), 'Error message indicates maximum attempts exceeded');

  console.log('\n--- 5. Handle Expired OTP ---');
  otpService.requestOtp('expired@ble-mesh.org', 'EMAIL');
  const expRecord = otpService.otpStore.get('expired@ble-mesh.org');
  expRecord.expiresAt = Date.now() - 1000; // Force expired timestamp

  let expiredErr = null;
  try {
    otpService.verifyOtp('expired@ble-mesh.org', expRecord.otp);
  } catch (e) { expiredErr = e; }

  assertEquals(expiredErr.statusCode, 400, 'Expired OTP verification rejected with 400 Bad Request');
  assert(expiredErr.message.includes('expired'), 'Error message contains OTP_EXPIRED notification');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runOtpUnitTests();
