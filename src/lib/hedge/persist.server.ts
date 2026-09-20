import { getSql } from "@/lib/db";
import { openSealed, seal } from "./crypto.server";
import type { HedgeConfig, Venue } from "./types";

export type StoredSession = {
  userId: string;
  venue: Exclude<Venue, "paper">;
  clientId: string;
  clientSecret: string;
  webhookUrl: string | null;
  config: HedgeConfig;
  armed: boolean;
  lastCycleAt: number;
  lastWakeAt: number;
};

type Row = {
  user_id: string;
  venue: string;
  client_id: string;
  secret_blob: string;
  webhook_blob: string | null;
  config_json: string;
  armed: number | boolean | string;
  last_cycle_at: number | string;
  last_wake_at?: number | string;
};

function asArmed(v: Row["armed"]) {
  return v === true || v === 1 || v === "1" || v === "t" || v === "true";
}

function decode(row: Row): StoredSession {
  return {
    userId: row.user_id,
    venue: row.venue === "testnet" ? "testnet" : "mainnet",
    clientId: row.client_id,
    clientSecret: openSealed(row.secret_blob),
    webhookUrl: row.webhook_blob ? openSealed(row.webhook_blob) : null,
    config: JSON.parse(row.config_json) as HedgeConfig,
    armed: asArmed(row.armed),
    lastCycleAt: Number(row.last_cycle_at) || 0,
    lastWakeAt: Number(row.last_wake_at) || 0,
  };
}

export async function upsertSession(s: StoredSession) {
  const sql = await getSql();
  const secretBlob = seal(s.clientSecret);
  const webhookBlob = s.webhookUrl ? seal(s.webhookUrl) : null;
  const configJson = JSON.stringify(s.config);
  const armed = s.armed ? 1 : 0;
  await sql`
    insert into hedge_sessions (user_id, venue, client_id, secret_blob, webhook_blob, config_json, armed, last_cycle_at, last_wake_at, updated_at)
    values (${s.userId}, ${s.venue}, ${s.clientId}, ${secretBlob}, ${webhookBlob}, ${configJson}, ${armed}, ${s.lastCycleAt}, ${s.lastWakeAt}, now())
    on conflict (user_id) do update set
      venue = excluded.venue,
      client_id = excluded.client_id,
      secret_blob = excluded.secret_blob,
      webhook_blob = excluded.webhook_blob,
      config_json = excluded.config_json,
      armed = excluded.armed,
      last_cycle_at = excluded.last_cycle_at,
      last_wake_at = excluded.last_wake_at,
      updated_at = now()
  `;
}

export async function deleteSession(userId: string) {
  const sql = await getSql();
  await sql`delete from hedge_sessions where user_id = ${userId}`;
}

export async function loadSession(userId: string): Promise<StoredSession | null> {
  const sql = await getSql();
  const rows = await sql<Row>`select user_id, venue, client_id, secret_blob, webhook_blob, config_json, armed, last_cycle_at, last_wake_at from hedge_sessions where user_id = ${userId} limit 1`;
  const row = rows[0];
  return row ? decode(row) : null;
}

export async function listArmedSessions(): Promise<StoredSession[]> {
  const sql = await getSql();
  const rows = await sql<Row>`select user_id, venue, client_id, secret_blob, webhook_blob, config_json, armed, last_cycle_at, last_wake_at from hedge_sessions where armed = 1`;
  const out: StoredSession[] = [];
  for (const row of rows) {
    try {
      out.push(decode(row));
    } catch {
      /* skip undecryptable rows */
    }
  }
  return out;
}
