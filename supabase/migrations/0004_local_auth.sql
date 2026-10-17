-- Self-hosted authentication (replaces Supabase Auth). Works on the plain-Postgres stand-in schema from tests_stub.sql.
-- Passwords are hashed in application code (scrypt); sessions and one-time tokens store only SHA-256 hashes.

alter table auth.users
  add column if not exists password_hash text,
  add column if not exists email_verified_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists users_email_lower_key on auth.users (lower(email));

create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  user_agent text
);
create index if not exists sessions_user_idx on auth.sessions (user_id);

create table if not exists auth.tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('verify_email', 'reset_password')),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists tokens_user_idx on auth.tokens (user_id);

-- Only the trusted server role may touch credentials; API roles (anon/authenticated) get nothing.
revoke all on auth.users, auth.sessions, auth.tokens from anon, authenticated;
grant select, insert, update, delete on auth.users, auth.sessions, auth.tokens to service_role;
