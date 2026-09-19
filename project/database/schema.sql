-- ===========================================
-- SVASTH Queue — Database Schema
-- Run this in your Supabase SQL Editor
-- ===========================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ===========================================
-- 1. HOSPITALS
-- ===========================================
create table hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  logo_url text,
  created_at timestamptz default now()
);

-- RLS
alter table hospitals enable row level security;

create policy "Anyone can read hospitals"
  on hospitals for select
  using (true);

create policy "Only authenticated users can modify hospitals"
  on hospitals for all
  using (auth.role() = 'authenticated');

-- ===========================================
-- 2. DOCTORS
-- ===========================================
create table doctors (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references hospitals(id) on delete cascade,
  name text not null,
  department text,
  room_number text,
  specialization text,
  avg_consultation_minutes integer default 10,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index idx_doctors_hospital on doctors(hospital_id);
create index idx_doctors_active on doctors(is_active) where is_active = true;

-- RLS
alter table doctors enable row level security;

create policy "Anyone can read active doctors"
  on doctors for select
  using (true);

create policy "Only authenticated users can modify doctors"
  on doctors for all
  using (auth.role() = 'authenticated');

-- ===========================================
-- 3. QUEUE SESSIONS
-- ===========================================
create table queue_sessions (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references doctors(id) on delete cascade,
  session_date date not null default current_date,
  current_token integer default 0,
  total_tokens integer default 0,
  status text default 'open' check (status in ('open', 'paused', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (doctor_id, session_date)
);

create index idx_queue_sessions_doctor_date on queue_sessions(doctor_id, session_date);

-- RLS
alter table queue_sessions enable row level security;

create policy "Anyone can read queue sessions"
  on queue_sessions for select
  using (true);

create policy "Only authenticated users can modify queue sessions"
  on queue_sessions for all
  using (auth.role() = 'authenticated');

-- Enable realtime for queue_sessions
alter publication supabase_realtime add table queue_sessions;

-- ===========================================
-- 4. PATIENTS
-- ===========================================
create table patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  consent_notifications boolean default false,
  created_at timestamptz default now()
);

create index idx_patients_phone on patients(phone);

-- RLS
alter table patients enable row level security;

create policy "Service role can manage patients"
  on patients for all
  using (auth.role() = 'service_role');

create policy "Authenticated users can read patients"
  on patients for select
  using (auth.role() = 'authenticated');

-- ===========================================
-- 5. QUEUE ENTRIES
-- ===========================================
create table queue_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references queue_sessions(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  token_number integer not null,
  status text default 'waiting' check (status in ('waiting', 'called', 'completed', 'skipped', 'cancelled')),
  priority boolean default false,
  tracking_token text unique not null,
  notified_approaching boolean default false,
  notified_called boolean default false,
  created_at timestamptz default now(),
  called_at timestamptz,
  completed_at timestamptz,
  unique(session_id, token_number)
);

create index idx_queue_entries_session on queue_entries(session_id);
create index idx_queue_entries_tracking on queue_entries(tracking_token);
create index idx_queue_entries_status on queue_entries(session_id, status);

-- RLS
alter table queue_entries enable row level security;

create policy "Anyone can read queue entries by tracking token"
  on queue_entries for select
  using (true);

create policy "Service role can manage queue entries"
  on queue_entries for all
  using (auth.role() = 'service_role');

create policy "Authenticated users can manage queue entries"
  on queue_entries for all
  using (auth.role() = 'authenticated');

-- Enable realtime for queue_entries
alter publication supabase_realtime add table queue_entries;

-- ===========================================
-- 6. NOTIFICATION LOGS
-- ===========================================
create table notification_logs (
  id uuid primary key default gen_random_uuid(),
  queue_entry_id uuid references queue_entries(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  channel text not null check (channel in ('sms', 'whatsapp')),
  notification_type text not null check (notification_type in ('registration', 'approaching', 'called')),
  message_content text,
  provider_message_id text,
  status text default 'pending' check (status in ('pending', 'sent', 'delivered', 'failed', 'mocked')),
  error_message text,
  created_at timestamptz default now()
);

create index idx_notification_logs_entry on notification_logs(queue_entry_id);

-- RLS
alter table notification_logs enable row level security;

create policy "Service role can manage notification logs"
  on notification_logs for all
  using (auth.role() = 'service_role');

create policy "Authenticated users can read notification logs"
  on notification_logs for select
  using (auth.role() = 'authenticated');

-- ===========================================
-- 7. STAFF USERS
-- ===========================================
create table staff_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  role text default 'receptionist' check (role in ('receptionist', 'doctor', 'admin')),
  hospital_id uuid references hospitals(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

create index idx_staff_users_auth on staff_users(auth_user_id);
create index idx_staff_users_email on staff_users(email);

-- RLS
alter table staff_users enable row level security;

create policy "Staff can read own record"
  on staff_users for select
  using (auth.uid() = auth_user_id);

create policy "Admins can manage staff"
  on staff_users for all
  using (
    exists (
      select 1 from staff_users
      where auth_user_id = auth.uid()
      and role = 'admin'
    )
  );

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Atomic next-token generator
create or replace function generate_next_token(target_session_id uuid)
returns integer
language plpgsql
as $$
declare
  next_number integer;
begin
  -- Lock the session row to prevent concurrent token generation
  perform id from queue_sessions where id = target_session_id for update;

  select coalesce(max(token_number), 0) + 1
  into next_number
  from queue_entries
  where session_id = target_session_id;

  -- Update total_tokens counter
  update queue_sessions
  set total_tokens = next_number,
      updated_at = now()
  where id = target_session_id;

  return next_number;
end;
$$;

-- Function to advance queue to next patient
create or replace function advance_queue(target_session_id uuid)
returns integer
language plpgsql
as $$
declare
  new_token integer;
  old_token integer;
begin
  -- Get current token
  select current_token into old_token
  from queue_sessions
  where id = target_session_id
  for update;

  -- Calculate new token
  new_token := old_token + 1;

  -- Mark previous patient as completed
  update queue_entries
  set status = 'completed',
      completed_at = now()
  where session_id = target_session_id
    and token_number = old_token
    and status = 'called';

  -- Mark new patient as called
  update queue_entries
  set status = 'called',
      called_at = now()
  where session_id = target_session_id
    and token_number = new_token
    and status = 'waiting';

  -- Update session current_token
  update queue_sessions
  set current_token = new_token,
      updated_at = now()
  where id = target_session_id;

  return new_token;
end;
$$;

-- Auto-update updated_at timestamp
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger queue_sessions_updated_at
  before update on queue_sessions
  for each row
  execute function update_updated_at();
