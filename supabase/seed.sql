-- Task 1.1.1: Seed Initial Roles & Initial Reference Data

-- 1. Seed Roles
INSERT INTO roles (name, description)
VALUES 
  ('ADMIN', 'System Administrator'),
  ('EMERGENCY_RESPONDER', 'Emergency Responder Node'),
  ('STANDARD_USER', 'Standard User Node')
ON CONFLICT (name) DO NOTHING;

-- 2. Seed Initial Admin User
INSERT INTO users (id, email, phone_number, full_name, role_id, account_status, verification_status)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  'admin@ble-mesh.org',
  '+18005550199',
  'System Administrator',
  r.id,
  'ACTIVE',
  'FULLY_VERIFIED'
FROM roles r WHERE r.name = 'ADMIN'
ON CONFLICT (email) DO NOTHING;

-- 3. Seed Initial Device
INSERT INTO devices (id, device_name, device_mac_address, device_type, mesh_public_key)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Primary Gateway C1',
  '00:1A:2B:3C:4D:5E',
  'GATEWAY_NODE',
  '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEb5TzwAIH5o36V0BNg+d19qBD8FmR\nu6V55MWy6KDHwj4ZMxhlaI8XIFAGUcA2DEJ7nbDZ8eVmfUEKk46EIHtmqQ==\n-----END PUBLIC KEY-----'
)
ON CONFLICT (device_mac_address) DO NOTHING;

-- 4. Seed User-Device Relationship
INSERT INTO user_devices (user_id, device_id, is_primary)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  true
)
ON CONFLICT (user_id, device_id) DO NOTHING;

-- 5. Seed Emergency Contact
INSERT INTO emergency_contacts (user_id, contact_name, contact_phone, relationship, priority_order)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'District 4 Rescue Control',
  '+18005559911',
  'Emergency Dispatch',
  1
)
ON CONFLICT (user_id, priority_order) DO NOTHING;
