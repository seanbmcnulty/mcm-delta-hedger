-- Encrypted stay-on sessions. Secret is AES-256-GCM (see persist.server.ts).
-- user_id is Better Auth text id. Cron restores armed rows after the host sleeps.

create table if not exists hedge_sessions (
  user_id text primary key,
  venue text not null,
  client_id text not null,
  secret_blob text not null,
  webhook_blob text,
  config_json text not null,
  armed integer not null default 0,
  last_cycle_at bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists hedge_sessions_armed_idx on hedge_sessions (armed);
