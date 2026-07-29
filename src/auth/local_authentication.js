/**
 * Task 1.1.4: Local Authentication Engine
 * Manages 4-6 digit PIN setup & hashing, offline authentication, session idle timeout,
 * lockout protection after 3 failed attempts, and local session logout.
 */

import crypto from 'crypto';

export class LocalAuthenticationManager {
  constructor(options = {}) {
    this.sessionTimeoutMs = options.sessionTimeoutMs || 300000; // 5 Minutes Idle Timeout
    this.maxFailedAttempts = options.maxFailedAttempts || 3;
    this.lockoutDurationMs = options.lockoutDurationMs || 900000; // 15 Minutes Lockout

    this.pinRecord = null; // { hash, salt }
    this.failedAttempts = 0;
    this.lockoutUntil = 0;
    this.activeSession = null; // { userId, authenticatedAt, lastActivity, isOffline }
  }

  // Hash PIN with PBKDF2
  hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.pbkdf2Sync(pin, salt, 10000, 32, 'sha256').toString('hex');
    return { hash, salt };
  }

  // 1. Setup Local PIN
  setupPin(pin) {
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      throw new Error('VALIDATION_ERROR: PIN must be a 4-6 digit number');
    }
    const { hash, salt } = this.hashPin(pin);
    this.pinRecord = { hash, salt, createdAt: new Date().toISOString() };
    this.failedAttempts = 0;
    this.lockoutUntil = 0;
    return true;
  }

  // 4. Check Lockout Status
  checkLockout() {
    if (this.lockoutUntil > Date.now()) {
      const remainingSeconds = Math.ceil((this.lockoutUntil - Date.now()) / 1000);
      throw new Error(`LOCKOUT_ERROR: Local account is locked due to failed attempts. Try again in ${remainingSeconds}s.`);
    }
    // Lockout expired, reset counter
    if (this.lockoutUntil !== 0 && Date.now() >= this.lockoutUntil) {
      this.failedAttempts = 0;
      this.lockoutUntil = 0;
    }
  }

  // 1 & 2. PIN Authentication & Offline Authentication
  authenticatePin(pin, userId = 'local-user-alpha', isOffline = true) {
    if (!this.pinRecord) {
      throw new Error('AUTH_ERROR: Local PIN has not been configured');
    }

    // Check Lockout (Subtask 4)
    this.checkLockout();

    const inputHash = crypto.pbkdf2Sync(pin, this.pinRecord.salt, 10000, 32, 'sha256').toString('hex');
    const isMatch = crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(this.pinRecord.hash, 'hex'));

    if (!isMatch) {
      this.failedAttempts++;
      if (this.failedAttempts >= this.maxFailedAttempts) {
        this.lockoutUntil = Date.now() + this.lockoutDurationMs;
        throw new Error(`LOCKOUT_ERROR: Account locked after ${this.maxFailedAttempts} failed PIN attempts.`);
      }
      const remaining = this.maxFailedAttempts - this.failedAttempts;
      throw new Error(`AUTH_ERROR: Invalid PIN. ${remaining} attempts remaining.`);
    }

    // Success: Reset failed attempt counter and establish session
    this.failedAttempts = 0;
    this.lockoutUntil = 0;

    const now = Date.now();
    this.activeSession = {
      sessionId: `SESS-LOCAL-${now}-${crypto.randomBytes(4).toString('hex')}`,
      userId,
      authenticatedAt: new Date(now).toISOString(),
      lastActivity: now,
      isOffline
    };

    return {
      success: true,
      message: 'Local PIN authenticated successfully in offline mode',
      session: this.activeSession
    };
  }

  // 3. Check & Enforce Session Idle Timeout
  checkSessionTimeout() {
    if (!this.activeSession) return { active: false, reason: 'No active session' };

    const now = Date.now();
    const idleTime = now - this.activeSession.lastActivity;

    if (idleTime > this.sessionTimeoutMs) {
      this.logout();
      return { active: false, reason: 'Session timed out due to inactivity' };
    }

    // Update last activity timestamp
    this.activeSession.lastActivity = now;
    return { active: true, idleTimeMs: idleTime };
  }

  // 5. Logout Functionality
  logout() {
    if (this.activeSession) {
      console.log(`Logging out local session [${this.activeSession.sessionId}]...`);
      this.activeSession = null;
      return true;
    }
    return false;
  }
}
