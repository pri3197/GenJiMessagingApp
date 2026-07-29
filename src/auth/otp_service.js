/**
 * Task 1.1.4: OTP Verification Service Engine
 * Generates 6-digit OTPs, simulates SMS & Email dispatch, tracks 5-minute expiry,
 * validates OTPs, enforces 3-attempt limits, and supports OTP re-sending.
 */

import crypto from 'crypto';
import { AuthDatabaseEngine, VerificationStatus } from '../db/auth_entities.js';

export class OtpService {
  constructor(authDb = new AuthDatabaseEngine()) {
    this.authDb = authDb;
    this.otpStore = new Map(); // identifier (email or phone) -> { otp, expiresAt, attempts, channel }
    this.sentMessages = []; // Dispatch log for SMS and Email
  }

  // 1. Generate 6-digit Numeric OTP
  generateOtpCode() {
    return String(crypto.randomInt(100000, 999999));
  }

  // 2. Send OTP via SMS Simulator
  sendSmsOtp(phone, otp) {
    const msg = { type: 'SMS', target: phone, content: `Your Emergency BLE Mesh OTP code is ${otp}. Valid for 5 minutes.`, timestamp: new Date().toISOString() };
    this.sentMessages.push(msg);
    console.log(`[SMS Gateway] Sent OTP to ${phone}: ${otp}`);
    return msg;
  }

  // 3. Send OTP via Email Simulator
  sendEmailOtp(email, otp) {
    const msg = { type: 'EMAIL', target: email, content: `Your Emergency BLE Mesh OTP code is ${otp}. Valid for 5 minutes.`, timestamp: new Date().toISOString() };
    this.sentMessages.push(msg);
    console.log(`[Email Gateway] Sent OTP to ${email}: ${otp}`);
    return msg;
  }

  // Request & Send OTP (Channels: 'EMAIL', 'SMS', or 'BOTH')
  requestOtp(identifier, channel = 'EMAIL') {
    if (!identifier) {
      throw { statusCode: 400, message: 'VALIDATION_ERROR: Target email or phone number required' };
    }

    const otp = this.generateOtpCode();
    const expiresAt = Date.now() + 300000; // 5 Minutes TTL

    // 4. Store OTP & Expiry with attempt tracker
    this.otpStore.set(identifier.toLowerCase(), {
      otp,
      expiresAt,
      attempts: 0,
      channel,
      maxAttempts: 3
    });

    if (channel === 'SMS' || identifier.startsWith('+')) {
      this.sendSmsOtp(identifier, otp);
    } else {
      this.sendEmailOtp(identifier, otp);
    }

    return {
      success: true,
      message: `OTP sent via ${channel}`,
      identifier,
      expiresInSeconds: 300
    };
  }

  // 5. Validate OTP & 6. Handle Expired OTP & 8. Limit OTP Attempts
  verifyOtp(identifier, submittedOtp) {
    if (!identifier || !submittedOtp) {
      throw { statusCode: 400, message: 'VALIDATION_ERROR: Identifier and OTP code required' };
    }

    const record = this.otpStore.get(identifier.toLowerCase());

    if (!record) {
      throw { statusCode: 400, message: 'OTP_ERROR: No active OTP record found for this user' };
    }

    // Check Attempt Limit (Subtask 8)
    if (record.attempts >= record.maxAttempts) {
      throw { statusCode: 429, message: 'OTP_ERROR: Maximum OTP verification attempts exceeded (3/3). Please request a new OTP.' };
    }

    // Check Expiration (Subtask 6)
    if (Date.now() > record.expiresAt) {
      this.otpStore.delete(identifier.toLowerCase());
      throw { statusCode: 400, message: 'OTP_ERROR: OTP code has expired. Please request a new code.' };
    }

    // Verify OTP Match
    if (record.otp !== String(submittedOtp).trim()) {
      record.attempts++;
      const remaining = record.maxAttempts - record.attempts;
      throw { statusCode: 400, message: `OTP_ERROR: Invalid OTP code. ${remaining} attempts remaining.` };
    }

    // On Success: Delete OTP Record
    this.otpStore.delete(identifier.toLowerCase());

    // Update User Verification Status in DB
    let userUpdated = false;
    for (const u of this.authDb.users.values()) {
      if (u.email.toLowerCase() === identifier.toLowerCase() || u.phone_number === identifier) {
        u.verification_status = VerificationStatus.FULLY_VERIFIED;
        u.updated_at = new Date().toISOString();
        userUpdated = true;
        break;
      }
    }

    return {
      success: true,
      message: 'OTP verified successfully. User verification complete.',
      identifier,
      verified: true,
      userUpdated
    };
  }

  // 7. Implement Resend OTP
  resendOtp(identifier) {
    if (!identifier) {
      throw { statusCode: 400, message: 'VALIDATION_ERROR: Identifier required to resend OTP' };
    }

    // Invalidate old OTP record
    this.otpStore.delete(identifier.toLowerCase());

    // Generate and send new OTP
    return this.requestOtp(identifier);
  }
}
