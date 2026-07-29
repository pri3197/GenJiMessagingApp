/**
 * Task 1.1.5: Device Registration Service Engine
 * Generates Device IDs, captures device metadata (OS, app version), generates 2048-bit RSA key pairs,
 * stores public keys, associates devices with users, registers BLE capabilities, and registers notification tokens.
 */

import crypto from 'crypto';
import { AuthDatabaseEngine } from '../db/auth_entities.js';

export class DeviceRegistrationService {
  constructor(authDb = new AuthDatabaseEngine()) {
    this.authDb = authDb;
  }

  // 1. Generate Unique Device ID
  generateDeviceId() {
    return `DEV-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  // 5. Generate 2048-bit RSA Key Pair
  generateRsaKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return { publicKey, privateKey };
  }

  // Core Device Registration Handler
  registerDevice(payload = {}) {
    const {
      userId,
      deviceName,
      deviceMacAddress,
      deviceType,
      osVersion,
      appVersion,
      bleCapability,
      notificationToken,
      isPrimary
    } = payload;

    // Validate Required Inputs
    if (!userId || !this.authDb.users.has(userId)) {
      throw { statusCode: 400, message: 'VALIDATION_ERROR: Valid associated userId is required' };
    }
    if (!deviceMacAddress) {
      throw { statusCode: 400, message: 'VALIDATION_ERROR: Device MAC address is required' };
    }

    // 1. Generate Device ID
    const deviceId = this.generateDeviceId();

    // 5. Generate RSA 2048-bit Key Pair
    const { publicKey, privateKey } = this.generateRsaKeyPair();

    // 2, 3, 4, 6, 8, 9. Store Device Information & Capabilities
    const deviceRecord = this.authDb.createDevice({
      id: deviceId,
      device_name: deviceName || 'BLE Mesh Mobile Node',
      device_mac_address: deviceMacAddress,
      device_type: deviceType || 'MOBILE_SMARTPHONE',
      mesh_public_key: publicKey
    });

    // Attach Extended Metadata (OS Version, App Version, BLE Capabilities, Notification Tokens)
    deviceRecord.os_version = osVersion || 'Android 14 / iOS 17.4';
    deviceRecord.app_version = appVersion || 'v1.0.0-production';
    deviceRecord.ble_capability = bleCapability || {
      bleVersion: '5.3',
      roles: ['RELAY', 'PROXY', 'NODE'],
      maxHops: 10,
      mtuSize: 247
    };
    deviceRecord.notification_token = notificationToken || `FCM-TOKEN-${crypto.randomBytes(16).toString('hex')}`;

    // 7. Associate Device with User
    const relationship = this.authDb.createUserDeviceRelationship(userId, deviceId, Boolean(isPrimary));

    return {
      success: true,
      message: 'Device registered and associated successfully.',
      deviceId: deviceRecord.id,
      userId,
      device: {
        id: deviceRecord.id,
        deviceName: deviceRecord.device_name,
        deviceMacAddress: deviceRecord.device_mac_address,
        deviceType: deviceRecord.device_type,
        osVersion: deviceRecord.os_version,
        appVersion: deviceRecord.app_version,
        bleCapability: deviceRecord.ble_capability,
        notificationToken: deviceRecord.notification_token,
        publicKey: deviceRecord.mesh_public_key,
        createdAt: deviceRecord.created_at
      },
      relationship: {
        id: relationship.id,
        isPrimary: relationship.is_primary,
        registeredAt: relationship.registered_at
      },
      privateKeyPEM: privateKey // Returned for local client secure storage
    };
  }
}
