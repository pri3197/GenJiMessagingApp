/**
 * Task 1.1.6: Local Secure Storage Engine
 * Configures AES-256-GCM authenticated local storage for:
 * 1. Cryptographic keys (ECDSA/RSA)
 * 2. Trusted mesh devices
 * 3. Offline app settings
 * 4. Cached mesh messages
 * 5. Gateway routing preferences
 */

import crypto from 'crypto';

export class LocalSecureStorageEngine {
  constructor(options = {}) {
    const masterPassword = options.masterPassword || 'DEFAULT_LOCAL_MASTER_KEY_SALT_2026';
    const salt = options.salt || 'BLE_MESH_SECURE_STORAGE_SALT';

    // Derive 256-bit encryption key using PBKDF2
    this.masterKey = crypto.scryptSync(masterPassword, salt, 32);
    this.storageVault = new Map(); // key -> { iv, ciphertext, authTag }
  }

  // 1. AES-256-GCM Encryption Method
  encrypt(plainText) {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);

    let ciphertext = cipher.update(JSON.stringify(plainText), 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      iv: iv.toString('hex'),
      ciphertext,
      authTag
    };
  }

  // 1. AES-256-GCM Decryption Method
  decrypt(encryptedPayload) {
    if (!encryptedPayload || !encryptedPayload.iv || !encryptedPayload.ciphertext || !encryptedPayload.authTag) {
      throw new Error('STORAGE_ERROR: Invalid encrypted payload format');
    }

    const iv = Buffer.from(encryptedPayload.iv, 'hex');
    const authTag = Buffer.from(encryptedPayload.authTag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedPayload.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  // Set encrypted entry in vault
  setItem(vaultKey, value) {
    const encryptedRecord = this.encrypt(value);
    this.storageVault.set(vaultKey, encryptedRecord);
    return true;
  }

  // Get and decrypt entry from vault
  getItem(vaultKey) {
    if (!this.storageVault.has(vaultKey)) return null;
    const encryptedRecord = this.storageVault.get(vaultKey);
    return this.decrypt(encryptedRecord);
  }

  // 2. Store & Load Cryptographic Keys
  storeCryptographicKeys(keys = {}) {
    return this.setItem('sec_keys', keys);
  }

  loadCryptographicKeys() {
    return this.getItem('sec_keys');
  }

  // 3. Store & Load Trusted Devices
  storeTrustedDevices(devices = []) {
    return this.setItem('sec_trusted_devices', devices);
  }

  loadTrustedDevices() {
    return this.getItem('sec_trusted_devices') || [];
  }

  // 4. Store & Load Offline Settings
  storeOfflineSettings(settings = {}) {
    return this.setItem('sec_offline_settings', settings);
  }

  loadOfflineSettings() {
    return this.getItem('sec_offline_settings') || {};
  }

  // 5. Store & Load Cached Messages
  storeCachedMessages(threadId, messages = []) {
    const key = `sec_msg_thread_${threadId}`;
    return this.setItem(key, messages);
  }

  loadCachedMessages(threadId) {
    const key = `sec_msg_thread_${threadId}`;
    return this.getItem(key) || [];
  }

  // 6. Store & Load Routing Preferences
  storeRoutingPreferences(preferences = {}) {
    return this.setItem('sec_routing_preferences', preferences);
  }

  loadRoutingPreferences() {
    return this.getItem('sec_routing_preferences') || {};
  }

  // Clear all vault data
  clearVault() {
    this.storageVault.clear();
    return true;
  }
}
