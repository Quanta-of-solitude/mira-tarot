// Tables. Applied automatically on first database use (lib/store.js) and by `npm run db:setup`.
export const SCHEMA = `
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  display_name text,
  image text,
  credits integer not null default 0 check (credits >= 0),
  created_at timestamptz not null default now()
);
create table if not exists devices (
  device_id text primary key,
  user_id uuid not null references users(id),
  created_at timestamptz not null default now()
);
create table if not exists readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  question text not null,
  cards jsonb not null,
  picked integer,
  status text not null default 'dealt',
  reading_text text,
  created_at timestamptz not null default now()
);
alter table users add column if not exists profile jsonb;
create index if not exists readings_user_idx on readings (user_id, created_at desc);
create table if not exists payments (
  order_id text primary key,
  user_id uuid not null references users(id),
  pack text not null,
  amount integer not null,
  credits integer not null,
  status text not null default 'created',
  payment_id text,
  created_at timestamptz not null default now(),
  credited_at timestamptz
);
create table if not exists login_codes (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sent_at timestamptz not null default now()
);
`;
