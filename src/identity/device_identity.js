/**
 * Task 1.1.1: Device Identity Management Engine
 * Generates unique UUIDs, ECDSA P-256 / RSA key pairs, securely stores private keys,
 * exports public keys, creates SHA-256 device fingerprints, validates identities, and handles key regeneration.
 */

import crypto from 'crypto';

export class DeviceIdentityManager {
  constructor(options = {}) {
    this.keyType = options.keyType || 'ec'; // 'ec' (ECDSA P-256) or 'rsa' (RSA 2048)
    this.macAddress = options.macAddress || '00:1A:2B:3C:4D:5E';
    this.secureKeystore = new Map(); // Private key vault
    this.identity = null;
  }

  // Subtask 1: Generate unique Device ID (UUID v4)
  generateDeviceId() {
    return crypto.randomUUID();
  }

  // Subtask 2: Generate RSA/ECDSA public-private key pair
  generateKeyPair() {
    if (this.keyType === 'ec') {
      return crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
    } else {
      return crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
    }
  }

  // Subtask 3: Securely store private key on device
  secureStorePrivateKey(deviceId, privateKeyPem) {
    // Encrypt private key with local master secret
    const masterKey = crypto.scryptSync('MASTER_DEVICE_SALT', 'device_keystore', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);

    let encrypted = cipher.update(privateKeyPem, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    this.secureKeystore.set(deviceId, {
      iv: iv.toString('hex'),
      encryptedPrivateKey: encrypted,
      authTag
    });
  }

  // Subtask 4: Export public key
  exportPublicKey() {
    if (!this.identity) throw new Error('IDENTITY_ERROR: Device identity has not been initialized');
    return this.identity.publicKey;
  }

  // Subtask 5: Generate device fingerprint (SHA-256 of Public Key + MAC Address)
  generateFingerprint(publicKeyPem, macAddress) {
    const hash = crypto.createHash('sha256');
    hash.update(publicKeyPem);
    hash.update(macAddress);
    return hash.digest('hex');
  }

  // Initialize or Generate Device Identity
  initIdentity() {
    const deviceId = this.generateDeviceId();
    const { publicKey, privateKey } = this.generateKeyPair();
    const fingerprint = this.generateFingerprint(publicKey, this.macAddress);

    this.secureStorePrivateKey(deviceId, privateKey);

    this.identity = {
      deviceId,
      publicKey,
      macAddress: this.macAddress,
      fingerprint,
      createdAt: new Date().toISOString()
    };

    return this.identity;
  }

  // Subtask 6: Validate generated identity
  validateIdentity(identity = this.identity) {
    if (!identity) return { valid: false, reason: 'Identity is null or undefined' };
    if (!identity.deviceId || typeof identity.deviceId !== 'string') return { valid: false, reason: 'Invalid deviceId UUID' };
    if (!identity.publicKey || !identity.publicKey.includes('BEGIN PUBLIC KEY')) return { valid: false, reason: 'Invalid public key format' };
    if (!identity.fingerprint || identity.fingerprint.length !== 64) return { valid: false, reason: 'Invalid SHA-256 fingerprint' };
    if (!this.secureKeystore.has(identity.deviceId)) return { valid: false, reason: 'Private key missing from secure vault' };

    // Verify Fingerprint match
    const expectedFingerprint = this.generateFingerprint(identity.publicKey, identity.macAddress);
    if (identity.fingerprint !== expectedFingerprint) {
      return { valid: false, reason: 'Fingerprint mismatch' };
    }

    return { valid: true };
  }

  // Subtask 7: Handle key regeneration
  regenerateKeyPair() {
    if (!this.identity) throw new Error('IDENTITY_ERROR: Identity not initialized');

    console.log(`Regenerating ECDSA/RSA key pair for device [${this.identity.deviceId}]...`);
    const { publicKey, privateKey } = this.generateKeyPair();
    const newFingerprint = this.generateFingerprint(publicKey, this.macAddress);

    this.secureStorePrivateKey(this.identity.deviceId, privateKey);

    this.identity.publicKey = publicKey;
    this.identity.fingerprint = newFingerprint;
    this.identity.updatedAt = new Date().toISOString();

    return this.identity;
  }
}
