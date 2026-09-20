alter table hedge_sessions add column if not exists last_wake_at bigint not null default 0;
