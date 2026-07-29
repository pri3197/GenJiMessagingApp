/**
 * Task 1.1.2: User Registration API Service Engine
 * Handles email, phone, password validation, duplicate checking, PBKDF2/HMAC hashing,
 * verification token generation, user storage, and exception handling.
 */

import crypto from 'crypto';
import { AuthDatabaseEngine, AccountStatus, VerificationStatus } from '../db/auth_entities.js';

export class RegistrationService {
  constructor(authDb = new AuthDatabaseEngine()) {
    this.authDb = authDb;
    this.verificationTokens = new Map(); // token -> { userId, expiresAt }
  }

  // 1. Email Format Validator
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw { statusCode: 400, message: 'VALIDATION_ERROR: Invalid email format' };
    }
  }

  // 2. Mobile Number Validator (E.164 standard)
  validateMobileNumber(phone) {
    if (!phone) return;
    const phoneRegex = /^\+?[1-9]\d{7,14}$/;
    if (!phoneRegex.test(phone)) {
      throw { statusCode: 400, message: 'VALIDATION_ERROR: Invalid mobile number format (E.164 required)' };
    }
  }

  // 3. Password Policy Validator (Min 8 chars, 1 upper, 1 lower, 1 digit, 1 special char)
  validatePasswordPolicy(password) {
    if (!password || password.length < 8) {
      throw { statusCode: 400, message: 'VALIDATION_ERROR: Password must be at least 8 characters long' };
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      throw { statusCode: 400, message: 'VALIDATION_ERROR: Password must contain uppercase, lowercase, digit, and special character' };
    }
  }

  // 4. Duplicate Account Check
  checkDuplicateAccount(email, phone) {
    for (const u of this.authDb.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        throw { statusCode: 409, message: 'DUPLICATE_ERROR: User with this email already exists' };
      }
      if (phone && u.phone_number === phone) {
        throw { statusCode: 409, message: 'DUPLICATE_ERROR: User with this mobile number already exists' };
      }
    }
  }

  // 5. Encrypt Password (PBKDF2 SHA-256)
  encryptPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
    return { salt, hash };
  }

  // 6. Generate Verification Token
  generateVerificationToken(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 86400000; // 24 Hours
    this.verificationTokens.set(token, { userId, expiresAt });
    return token;
  }

  // 7. Core Register User Handler
  registerUser(payload = {}) {
    const { email, phone_number, password, full_name } = payload;

    // Validate Inputs
    this.validateEmail(email);
    this.validateMobileNumber(phone_number);
    this.validatePasswordPolicy(password);
    this.checkDuplicateAccount(email, phone_number);

    // Encrypt Password
    const { salt, hash } = this.encryptPassword(password);

    // Store User Information
    const user = this.authDb.createUser({
      email,
      phone_number,
      full_name: full_name || 'Emergency User',
      account_status: AccountStatus.PENDING_VERIFICATION,
      verification_status: VerificationStatus.UNVERIFIED
    });

    user.password_hash = hash;
    user.password_salt = salt;

    // Generate Verification Token
    const verificationToken = this.generateVerificationToken(user.id);

    // Return Registration Response (Excluding Password Hash/Salt)
    return {
      success: true,
      message: 'User registered successfully. Verification token generated.',
      user: {
        id: user.id,
        email: user.email,
        phone_number: user.phone_number,
        full_name: user.full_name,
        account_status: user.account_status,
        verification_status: user.verification_status,
        created_at: user.created_at
      },
      verificationToken
    };
  }
}
