/**
 * Task 1.1.3: User Login API Service Engine
 * Validates credentials, checks account status, generates JWT access tokens and refresh tokens,
 * stores refresh tokens, tracks invalid attempts, and records login audit logs.
 */

import crypto from 'crypto';
import { AuthDatabaseEngine, AccountStatus } from '../db/auth_entities.js';

export class LoginService {
  constructor(authDb = new AuthDatabaseEngine(), secretKey = 'BLE_MESH_EMERGENCY_JWT_SECRET_KEY') {
    this.authDb = authDb;
    this.secretKey = secretKey;
    this.refreshTokens = new Map(); // refreshToken -> { userId, expiresAt }
    this.auditLogs = [];
    this.failedAttempts = new Map(); // email -> count
  }

  // Generate HMAC-SHA256 Base64Url JWT Token
  generateJwt(payload, expiresInSeconds = 900) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

    const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');

    const signatureInput = `${b64Header}.${b64Payload}`;
    const signature = crypto.createHmac('sha256', this.secretKey).update(signatureInput).digest('base64url');

    return `${signatureInput}.${signature}`;
  }

  // Generate 64-char Crypto Refresh Token
  generateRefreshToken(userId) {
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 86400000; // 7 Days
    this.refreshTokens.set(refreshToken, { userId, expiresAt });
    return refreshToken;
  }

  // Verify PBKDF2 Password
  verifyPassword(inputPassword, storedHash, storedSalt) {
    if (!storedHash || !storedSalt) return false;
    const hash = crypto.pbkdf2Sync(inputPassword, storedSalt, 10000, 64, 'sha256').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  }

  // Record Audit Log Entry
  logAudit(userId, email, ipAddress, status, reason = '') {
    const logEntry = {
      id: `audit-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      timestamp: new Date().toISOString(),
      userId: userId || null,
      email,
      ipAddress: ipAddress || '127.0.0.1',
      status,
      reason
    };
    this.auditLogs.unshift(logEntry);
    return logEntry;
  }

  // Core Login Handler
  loginUser(credentials = {}, ipAddress = '127.0.0.1') {
    const { email, password } = credentials;

    if (!email || !password) {
      this.logAudit(null, email || 'UNKNOWN', ipAddress, 'FAILED_MISSING_CREDENTIALS', 'Email and password are required');
      throw { statusCode: 400, message: 'VALIDATION_ERROR: Email and password are required' };
    }

    // Find User by Email
    let targetUser = null;
    for (const u of this.authDb.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        targetUser = u;
        break;
      }
    }

    if (!targetUser) {
      this.logAudit(null, email, ipAddress, 'FAILED_INVALID_CREDENTIALS', 'User not found');
      throw { statusCode: 401, message: 'AUTHENTICATION_ERROR: Invalid email or password' };
    }

    // Verify Account Status
    if (targetUser.account_status === AccountStatus.SUSPENDED || targetUser.account_status === AccountStatus.DEACTIVATED) {
      this.logAudit(targetUser.id, email, ipAddress, 'FAILED_SUSPENDED_ACCOUNT', `Account status is ${targetUser.account_status}`);
      throw { statusCode: 403, message: `AUTHORIZATION_ERROR: Account is ${targetUser.account_status.toLowerCase()}` };
    }

    // Verify Password Hash
    const isPasswordValid = this.verifyPassword(password, targetUser.password_hash, targetUser.password_salt);
    if (!isPasswordValid) {
      const attempts = (this.failedAttempts.get(email) || 0) + 1;
      this.failedAttempts.set(email, attempts);
      this.logAudit(targetUser.id, email, ipAddress, 'FAILED_INVALID_CREDENTIALS', `Invalid password attempt #${attempts}`);
      throw { statusCode: 401, message: 'AUTHENTICATION_ERROR: Invalid email or password' };
    }

    // Reset Failed Attempts on Success
    this.failedAttempts.delete(email);

    // Generate JWT Access Token & Refresh Token
    const accessToken = this.generateJwt({
      userId: targetUser.id,
      email: targetUser.email,
      role: targetUser.role_id
    }, 900); // 15 mins

    const refreshToken = this.generateRefreshToken(targetUser.id);

    // Record Successful Audit Log
    this.logAudit(targetUser.id, email, ipAddress, 'SUCCESS', 'Authentication successful');

    return {
      success: true,
      message: 'Authentication successful',
      tokenType: 'Bearer',
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        full_name: targetUser.full_name,
        account_status: targetUser.account_status,
        verification_status: targetUser.verification_status,
        role_id: targetUser.role_id
      }
    };
  }
}
