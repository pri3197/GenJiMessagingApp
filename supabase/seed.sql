-- Task 1.1.1: Seed Initial Roles & Initial Reference Data

-- 1. Seed Roles
INSERT INTO roles (id, name, description)
VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ADMIN', 'System Administrator with full diagnostic and management rights'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'EMERGENCY_RESPONDER', 'First Responder node with priority triage routing rights'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'STANDARD_USER', 'Standard BLE Mesh mobile user')
ON CONFLICT (name) DO NOTHING;

-- 2. Seed Initial Admin User
INSERT INTO users (id, email, phone_number, full_name, account_status, verification_status, role_id)
VALUES 
  (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    'admin@ble-mesh.org',
    '+15550192834',
    'System Administrator',
    'ACTIVE',
    'FULLY_VERIFIED',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  )
ON CONFLICT (email) DO NOTHING;

-- 3. Seed Initial Device
INSERT INTO devices (id, device_name, device_mac_address, device_type, mesh_public_key)
VALUES
  (
    'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
    'Node-User-Alpha',
    '00:1A:2B:3C:4D:5E',
    'BLE_MESH_PRIMARY_NODE',
    '04:a1:b2:c3:d4:e5:f6:78:90:ab:cd:ef:12:34:56:78:90:ab:cd:ef'
  )
ON CONFLICT (device_mac_address) DO NOTHING;

-- 4. Seed User-Device Relationship
INSERT INTO user_devices (user_id, device_id, is_primary)
VALUES
  (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
    true
  )
ON CONFLICT (user_id, device_id) DO NOTHING;

-- 5. Seed Emergency Contact
INSERT INTO emergency_contacts (user_id, contact_name, contact_phone, relationship, priority_order)
VALUES
  (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    'District 4 Rescue Control',
    '+15559110000',
    'Emergency Services',
    1
  )
ON CONFLICT (user_id, priority_order) DO NOTHING;
