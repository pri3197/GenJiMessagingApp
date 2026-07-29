/**
 * Task 1.1.1: Authentication Database Entity Models & Constraint Validation Engine
 */

export const AccountStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  DEACTIVATED: 'DEACTIVATED'
};

export const VerificationStatus = {
  UNVERIFIED: 'UNVERIFIED',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  PHONE_VERIFIED: 'PHONE_VERIFIED',
  FULLY_VERIFIED: 'FULLY_VERIFIED'
};

export const RoleType = {
  ADMIN: 'ADMIN',
  EMERGENCY_RESPONDER: 'EMERGENCY_RESPONDER',
  STANDARD_USER: 'STANDARD_USER'
};

export class AuthDatabaseEngine {
  constructor() {
    this.roles = new Map();
    this.users = new Map();
    this.devices = new Map();
    this.userDevices = [];
    this.emergencyContacts = [];

    this.seedRoles();
  }

  seedRoles() {
    const defaultRoles = [
      { id: 'role-admin', name: RoleType.ADMIN, description: 'System Administrator' },
      { id: 'role-responder', name: RoleType.EMERGENCY_RESPONDER, description: 'Emergency Responder Node' },
      { id: 'role-user', name: RoleType.STANDARD_USER, description: 'Standard BLE Mesh User' }
    ];

    defaultRoles.forEach(r => {
      this.roles.set(r.id, {
        ...r,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });
  }

  // Create User Entity with constraint validation
  createUser(userData = {}) {
    if (!userData.email || !userData.email.includes('@')) {
      throw new Error('CONSTRAINT_VIOLATION: Valid email is required');
    }

    // Unique email constraint
    for (const u of this.users.values()) {
      if (u.email === userData.email) {
        throw new Error('CONSTRAINT_VIOLATION: Email must be unique');
      }
      if (userData.phone_number && u.phone_number === userData.phone_number) {
        throw new Error('CONSTRAINT_VIOLATION: Phone number must be unique');
      }
    }

    // Account status & verification status validation
    const accountStatus = userData.account_status || AccountStatus.PENDING_VERIFICATION;
    if (!Object.values(AccountStatus).includes(accountStatus)) {
      throw new Error(`CONSTRAINT_VIOLATION: Invalid account_status [${accountStatus}]`);
    }

    const verificationStatus = userData.verification_status || VerificationStatus.UNVERIFIED;
    if (!Object.values(VerificationStatus).includes(verificationStatus)) {
      throw new Error(`CONSTRAINT_VIOLATION: Invalid verification_status [${verificationStatus}]`);
    }

    const user = {
      id: userData.id || `user-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      email: userData.email,
      phone_number: userData.phone_number || null,
      full_name: userData.full_name || 'Unnamed User',
      account_status: accountStatus,
      verification_status: verificationStatus,
      role_id: userData.role_id || 'role-user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.users.set(user.id, user);
    return user;
  }

  // Create Device Entity with constraint validation
  createDevice(deviceData = {}) {
    if (!deviceData.device_mac_address) {
      throw new Error('CONSTRAINT_VIOLATION: MAC address is required');
    }
    if (!deviceData.mesh_public_key) {
      throw new Error('CONSTRAINT_VIOLATION: Mesh public key is required');
    }

    for (const d of this.devices.values()) {
      if (d.device_mac_address === deviceData.device_mac_address) {
        throw new Error('CONSTRAINT_VIOLATION: Device MAC address must be unique');
      }
      if (d.mesh_public_key === deviceData.mesh_public_key) {
        throw new Error('CONSTRAINT_VIOLATION: Mesh public key must be unique');
      }
    }

    const device = {
      id: deviceData.id || `device-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      device_name: deviceData.device_name || 'BLE Mesh Node',
      device_mac_address: deviceData.device_mac_address,
      device_type: deviceData.device_type || 'BLE_MESH_NODE',
      mesh_public_key: deviceData.mesh_public_key,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.devices.set(device.id, device);
    return device;
  }

  // Create User-Device Relationship Junction Record
  createUserDeviceRelationship(userId, deviceId, isPrimary = false) {
    if (!this.users.has(userId)) {
      throw new Error(`FOREIGN_KEY_VIOLATION: User [${userId}] does not exist`);
    }
    if (!this.devices.has(deviceId)) {
      throw new Error(`FOREIGN_KEY_VIOLATION: Device [${deviceId}] does not exist`);
    }

    const exists = this.userDevices.some(ud => ud.user_id === userId && ud.device_id === deviceId);
    if (exists) {
      throw new Error('CONSTRAINT_VIOLATION: User-Device relationship already exists');
    }

    const relationship = {
      id: `ud-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      user_id: userId,
      device_id: deviceId,
      is_primary: isPrimary,
      registered_at: new Date().toISOString()
    };

    this.userDevices.push(relationship);
    return relationship;
  }

  // Create Emergency Contact Entity
  createEmergencyContact(contactData = {}) {
    if (!this.users.has(contactData.user_id)) {
      throw new Error(`FOREIGN_KEY_VIOLATION: User [${contactData.user_id}] does not exist`);
    }
    if (!contactData.contact_name || !contactData.contact_phone) {
      throw new Error('CONSTRAINT_VIOLATION: Contact name and phone are required');
    }

    const priority = contactData.priority_order || 1;
    const existsPriority = this.emergencyContacts.some(ec => ec.user_id === contactData.user_id && ec.priority_order === priority);
    if (existsPriority) {
      throw new Error(`CONSTRAINT_VIOLATION: Priority order [${priority}] already used for this user`);
    }

    const contact = {
      id: contactData.id || `contact-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      user_id: contactData.user_id,
      contact_name: contactData.contact_name,
      contact_phone: contactData.contact_phone,
      relationship: contactData.relationship || 'Emergency Contact',
      priority_order: priority,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.emergencyContacts.push(contact);
    return contact;
  }
}
