-- ===========================================
-- SVASTH Queue — Seed Data
-- Run this after schema.sql in your Supabase SQL Editor
-- ===========================================

-- Insert a sample hospital
insert into hospitals (id, name, address, phone) values
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'SVASTH General Hospital', '123 Medical Avenue, New Delhi, India 110001', '+91-11-2345-6789');

-- Insert sample doctors
insert into doctors (id, hospital_id, name, department, room_number, specialization, avg_consultation_minutes) values
  (
    'd1000001-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Dr. Priya Sharma',
    'General Medicine',
    '101',
    'Internal Medicine',
    8
  ),
  (
    'd1000001-0000-0000-0000-000000000002',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Dr. Rajesh Patel',
    'Orthopedics',
    '205',
    'Joint & Bone Specialist',
    12
  ),
  (
    'd1000001-0000-0000-0000-000000000003',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Dr. Ananya Gupta',
    'Pediatrics',
    '310',
    'Child Healthcare',
    10
  );

-- Note: Staff users must be created after the user signs up via Supabase Auth.
-- After creating a user in Supabase Auth, insert a corresponding staff_users record:
--
-- insert into staff_users (auth_user_id, email, name, role, hospital_id) values
--   ('<auth-user-uuid>', 'admin@svasth.com', 'Admin User', 'admin', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
