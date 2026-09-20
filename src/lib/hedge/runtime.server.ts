import { DeribitClient, fetchPublicIndex } from "@/lib/deribit/client.server";
import { HedgeEngine } from "./engine";
import type { Alert, ConnectInput, HedgeConfig, Snapshot, TickSource, Venue } from "./types";
import { restoreConfig } from "./evaluate";
import { getRvCache, refreshRv } from "./rv.server";
import { minRvForLookback, secFromFreq, type FreqId, type LookbackId } from "./rv";
import { assertSafeWebhook, postWebhook } from "./notify.server";
import { redact } from "./redact";
import { deleteSession, listArmedSessions, loadSession, upsertSession } from "./persist.server";

const ENGINE_REV = 18;
const LOOP_MS = 2000;
const WATCH_MS = 5000;
const CONNECT_WINDOW_MS = 60_000;
const CONNECT_MAX = 5;

type Slot = {
  engine: HedgeEngine;
  seed?: Promise<void>;
  connects: number[];
  clientId: string;
  clientSecret: string;
  webhook: string;
  hydrated: boolean;
  persisted: boolean;
};

const g = globalThis as typeof globalThis & {
  __keelByUser?: Map<string, Slot>;
  __keelRev?: number;
  __keelLoop?: ReturnType<typeof setInterval>;
  __keelWatch?: ReturnType<typeof setInterval>;
};

function slots() {
  if (!g.__keelByUser || g.__keelRev !== ENGINE_REV) {
    if (g.__keelLoop) {
      clearInterval(g.__keelLoop);
      g.__keelLoop = undefined;
    }
    if (g.__keelWatch) {
      clearInterval(g.__keelWatch);
      g.__keelWatch = undefined;
    }
    g.__keelByUser = new Map();
    g.__keelRev = ENGINE_REV;
  }
  return g.__keelByUser;
}

function slot(userId: string): Slot {
  const map = slots();
  let s = map.get(userId);
  if (!s) {
    s = {
      engine: new HedgeEngine(),
      connects: [],
      clientId: "",
      clientSecret: "",
      webhook: "",
      hydrated: false,
      persisted: false,
    };
    map.set(userId, s);
    startLoops();
  }
  return s;
}

function engine(userId: string) {
  return slot(userId).engine;
}

function startLoops() {
  if (!g.__keelLoop) {
    g.__keelLoop = setInterval(() => {
      void (async () => {
        for (const s of slots().values()) {
          try {
            s.engine.serverLoop = true;
            if (!s.seed) s.seed = seedPaperIndex(s.engine);
            await s.seed;
            await s.engine.tick("server");
            maybeLockFreq(s.engine);
            await flushNotify(s.engine);
          } catch {
            /* watchdog will trip if this stays dead */
          }
        }
      })();
    }, LOOP_MS);
  }
  if (!g.__keelWatch) {
    g.__keelWatch = setInterval(() => {
      void (async () => {
        for (const s of slots().values()) {
          try {
            s.engine.serverLoop = true;
            await s.engine.watchdog();
            await flushNotify(s.engine);
          } catch {
            /* ignore */
          }
        }
      })();
    }, WATCH_MS);
  }
}

async function ensureReady(userId: string) {
  const s = slot(userId);
  s.engine.serverLoop = true;
  if (!s.seed) s.seed = seedPaperIndex(s.engine);
  await s.seed;
  if (!s.hydrated) {
    s.hydrated = true;
    try {
      await hydrateFromDb(userId);
    } catch (err) {
      s.engine.log("warn", `Stay-on restore failed · ${redact(err)}`);
    }
  }
  return s.engine;
}

async function seedPaperIndex(e: HedgeEngine) {
  try {
    const idx = await fetchPublicIndex();
    if (idx.BTC > 0 && idx.ETH > 0) {
      e.paper.seedIndex(idx.BTC, idx.ETH);
      e.indices = { BTC: idx.BTC, ETH: idx.ETH };
      e.indexSource = idx.source;
      e.log("info", `Paper marks seeded from Deribit index (${idx.source}) · BTC ${idx.BTC.toFixed(0)} · ETH ${idx.ETH.toFixed(0)}`);
    }
  } catch {
    e.log("warn", "Public index fetch failed — using default paper marks.");
    e.raise({
      severity: "warn",
      kind: "index",
      title: "Index seed failed",
      detail: "Public Deribit index unreachable. Paper using fallback marks.",
    });
  }
  e.warmup(Date.now());
  void refreshRv();
}

function withRv(e: HedgeEngine, userId?: string): Snapshot {
  maybeLockFreq(e);
  e.serverLoop = true;
  const snap = { ...e.snapshot(), rv: getRvCache() };
  if (userId) snap.stayAlivePersisted = slot(userId).persisted;
  return snap;
}

function wipeCreds(userId: string) {
  const s = slot(userId);
  s.clientId = "";
  s.clientSecret = "";
  s.webhook = "";
  s.persisted = false;
}

async function persistIfAlive(userId: string) {
  const s = slot(userId);
  const e = s.engine;
  if (!e.config.stayAlive || e.venue === "paper" || !s.clientSecret) {
    if (s.persisted) {
      await deleteSession(userId);
      s.persisted = false;
    }
    return;
  }
  await upsertSession({
    userId,
    venue: e.venue === "testnet" ? "testnet" : "mainnet",
    clientId: s.clientId,
    clientSecret: s.clientSecret,
    webhookUrl: e.webhookUrl,
    config: e.config,
    armed: e.armed,
    lastCycleAt: e.lastCycleAt,
    lastWakeAt: e.lastWakeAt,
  });
  s.persisted = true;
}

async function hydrateFromDb(userId: string) {
  const stored = await loadSession(userId);
  if (!stored) return;
  const s = slot(userId);
  const e = s.engine;
  e.setConfig({ ...stored.config, stayAlive: true });
  if (stored.webhookUrl) {
    try {
      e.webhookUrl = assertSafeWebhook(stored.webhookUrl);
    } catch {
      e.webhookUrl = null;
    }
  }
  if (e.deribit && e.connected && e.venue === stored.venue && s.clientId === stored.clientId) {
    if (!e.lastWakeAt) e.lastWakeAt = stored.lastWakeAt;
    if (stored.armed && !e.armed) {
      e.arm();
      e.lastCycleAt = stored.lastCycleAt;
      e.lastWakeAt = stored.lastWakeAt;
    }
    s.persisted = true;
    return;
  }
  const client = new DeribitClient(stored.venue, stored.clientId, stored.clientSecret);
  await client.authenticate();
  s.clientId = stored.clientId;
  s.clientSecret = stored.clientSecret;
  s.webhook = stored.webhookUrl ?? "";
  e.deribit = client;
  e.venue = stored.venue;
  e.connected = true;
  e.clientIdMasked = client.maskedId();
  e.circuit = "closed";
  e.log("info", `Stay-on restored ${stored.venue} · ${e.clientIdMasked}`);
  e.lastWakeAt = stored.lastWakeAt;
  if (stored.armed) {
    e.arm();
    e.lastCycleAt = stored.lastCycleAt;
    e.lastWakeAt = stored.lastWakeAt;
    if (stored.lastWakeAt && Date.now() - stored.lastWakeAt > 180_000) {
      e.raise({
        severity: "warn",
        kind: "watchdog",
        title: "Background worker stale",
        detail: "No wake in 3+ minutes. Worker should fire every 60s while published.",
      });
    }
  }
  s.persisted = true;
  await e.tick("server");
}

export async function cronSweep() {
  startLoops();
  const rows = await listArmedSessions();
  const results: Array<{ id: string; ok: boolean; detail?: string }> = [];
  const budgetMs = 45_000;
  for (const row of rows) {
    try {
      const s = slot(row.userId);
      s.hydrated = true;
      const e = s.engine;
      if (!e.deribit || !e.connected || e.venue !== row.venue || s.clientId !== row.clientId) {
        s.hydrated = false;
        await hydrateFromDb(row.userId);
      }
      const live = slot(row.userId).engine;
      const until = Date.now() + budgetMs;
      if (live.armed) {
        live.config.stayAlive = true;
        while (Date.now() < until) {
          await live.tick("server");
          live.lastWakeAt = Date.now();
          if (Date.now() + 1800 >= until) break;
          await new Promise((r) => setTimeout(r, 1800));
        }
      }
      await persistIfAlive(row.userId);
      await flushNotify(live);
      results.push({ id: live.clientIdMasked || "••••", ok: true });
    } catch (err) {
      results.push({ id: "••••", ok: false, detail: redact(err) });
    }
  }
  return { t: Date.now(), n: results.length, results };
}

function maybeLockFreq(e: HedgeEngine) {
  if (e.config.freqPolicy !== "min_rv") return;
  const cache = getRvCache();
  if (!cache) return;
  const best = minRvForLookback(cache.BTC, e.config.targetLookback);
  if (!best) return;
  const sec = secFromFreq(best.freqId);
  if (sec === e.config.intervalSec) return;
  e.config.intervalSec = sec;
  e.log(
    "policy",
    `Min-RV lock · ${e.config.targetLookback} → ${best.freqId} (${best.rv.toFixed(2)}% composite BTC)`,
  );
}

async function flushNotify(e: HedgeEngine) {
  const q = e.drainNotify();
  if (!q.length || !e.webhookUrl) return;
  for (const a of q) {
    if (a.severity === "info") continue;
    try {
      await postWebhook(e.webhookUrl, a);
    } catch (err) {
      e.log("error", `Webhook delivery failed: ${redact(err)}`);
    }
  }
}

function allowConnect(userId: string) {
  const now = Date.now();
  const list = slot(userId).connects;
  while (list.length && now - list[0]! > CONNECT_WINDOW_MS) list.shift();
  if (list.length >= CONNECT_MAX) throw new Error("Too many connect attempts. Wait a minute.");
  list.push(now);
}

export function getEngine(userId: string) {
  return engine(userId);
}

export async function snapshot(userId: string): Promise<Snapshot> {
  const e = await ensureReady(userId);
  void refreshRv();
  return withRv(e, userId);
}

export async function connect(userId: string, input: ConnectInput) {
  const e = await ensureReady(userId);
  if (input.venue === "paper") {
    e.venue = "paper";
    e.deribit?.wipe();
    e.deribit = null;
    e.connected = true;
    e.clientIdMasked = "";
    e.armed = false;
    wipeCreds(userId);
    await deleteSession(userId);
    if (input.webhookUrl?.trim()) e.webhookUrl = assertSafeWebhook(input.webhookUrl);
    e.log("info", "Venue set to paper. Short-gamma book is simulated; no live orders.");
    await flushNotify(e);
    return withRv(e, userId);
  }
  allowConnect(userId);
  const id = input.clientId.trim();
  const secret = input.clientSecret.trim();
  if (id.length < 8 || secret.length < 8) throw new Error("Client ID and secret look too short.");
  if (input.webhookUrl?.trim()) e.webhookUrl = assertSafeWebhook(input.webhookUrl);
  const client = new DeribitClient(input.venue, id, secret);
  try {
    await client.authenticate();
  } catch (err) {
    e.raise({
      severity: "critical",
      kind: "auth_fail",
      title: "Auth failed",
      detail: redact(err),
    });
    await flushNotify(e);
    throw new Error(redact(err));
  }
  e.deribit = client;
  e.venue = input.venue;
  e.connected = true;
  e.clientIdMasked = client.maskedId();
  e.armed = false;
  e.circuit = "closed";
  const s = slot(userId);
  s.clientId = id;
  s.clientSecret = secret;
  s.webhook = e.webhookUrl ?? "";
  e.log("info", `Authenticated ${input.venue} · ${e.clientIdMasked} · engine stays disarmed until you arm it.`);
  await e.tick("server");
  await persistIfAlive(userId);
  await flushNotify(e);
  return withRv(e, userId);
}

export async function disconnect(userId: string) {
  const e = await ensureReady(userId);
  e.armed = false;
  e.config.stayAlive = false;
  e.deribit?.wipe();
  e.deribit = null;
  e.venue = "paper";
  e.connected = true;
  e.clientIdMasked = "";
  wipeCreds(userId);
  await deleteSession(userId);
  e.log("warn", "Live session dropped. Keys wiped from memory and stay-on store. Back on paper.");
  await flushNotify(e);
  return withRv(e, userId);
}

export async function patchConfig(userId: string, patch: Partial<HedgeConfig>) {
  const e = await ensureReady(userId);
  const wantStay = patch.stayAlive === true;
  if (wantStay && (e.venue === "paper" || !slot(userId).clientSecret)) {
    throw new Error("Connect live keys before Stay on. Paper cannot persist a live session.");
  }
  const was = e.config.stayAlive;
  e.setConfig(patch);
  await persistIfAlive(userId);
  if (e.config.stayAlive && !was) e.log("info", "Background on — keys encrypted at rest, worker every 1 min.");
  if (!e.config.stayAlive && was) e.log("warn", "Background off — encrypted session deleted.");
  return withRv(e, userId);
}

export async function resetConfig(userId: string) {
  const e = await ensureReady(userId);
  const stay = e.config.stayAlive;
  e.setConfig({ ...restoreConfig(), stayAlive: stay });
  await persistIfAlive(userId);
  return withRv(e, userId);
}

export async function arm(userId: string, confirm?: string) {
  const e = await ensureReady(userId);
  if (e.venue === "mainnet" && confirm !== "ARM") {
    throw new Error("Type ARM to confirm live mainnet hedging.");
  }
  if (e.venue !== "paper" && slot(userId).clientSecret) {
    if (!e.config.stayAlive) {
      e.config.stayAlive = true;
      e.log("info", "Background on — keys encrypted, worker wakes every 1 min with the tab closed.");
    }
  }
  e.arm();
  await persistIfAlive(userId);
  await flushNotify(e);
  return withRv(e, userId);
}

export async function disarm(userId: string) {
  const e = await ensureReady(userId);
  e.disarm();
  await persistIfAlive(userId);
  return withRv(e, userId);
}

export async function kill(userId: string) {
  const e = await ensureReady(userId);
  await e.kill();
  await persistIfAlive(userId);
  await flushNotify(e);
  return withRv(e, userId);
}

export async function tick(userId: string, source: TickSource = "client") {
  const e = await ensureReady(userId);
  const s = await e.tick(source);
  maybeLockFreq(e);
  await flushNotify(e);
  return { ...s, rv: getRvCache(), stayAlivePersisted: slot(userId).persisted };
}

export async function runCoach(userId: string) {
  const e = await ensureReady(userId);
  const snap = e.snapshot();
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    e.coach = {
      t: Date.now(),
      text: snap.suggestions.join("\n") + "\n\n(AI coach unavailable in this environment — showing heuristic notes.)",
    };
    return withRv(e, userId);
  }
  const { coachPrompt } = await import("./evaluate");
  const prompt = coachPrompt({
    quality: snap.quality,
    config: snap.config,
    suggestions: snap.suggestions,
    cycles: snap.cycles,
    gamma: { BTC: snap.greeks.BTC.gamma, ETH: snap.greeks.ETH.gamma },
    counterfactuals: snap.counterfactuals,
  });
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    e.coach = { t: Date.now(), text: `Coach error ${res.status}. Heuristics:\n${snap.suggestions.join("\n")}` };
    return withRv(e, userId);
  }
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  e.coach = { t: Date.now(), text: body.choices[0]?.message.content ?? "No response." };
  e.log("policy", "Coach evaluation recorded.");
  return withRv(e, userId);
}

export async function setVenue(userId: string, venue: Venue) {
  const e = await ensureReady(userId);
  if (venue === "paper") return disconnect(userId);
  e.venue = venue;
  e.armed = false;
  e.connected = false;
  e.deribit?.wipe();
  e.deribit = null;
  e.log("info", `Venue ${venue} selected — paste API keys and connect. Engine will not arm until then.`);
  return withRv(e, userId);
}

export async function selectRvCell(userId: string, freqId: FreqId, lookbackId: LookbackId) {
  const e = await ensureReady(userId);
  e.setConfig({
    intervalSec: secFromFreq(freqId),
    targetLookback: lookbackId,
    freqPolicy: "manual",
  });
  e.log("policy", `Hedge frequency pinned to ${freqId} from ${lookbackId} RV cell.`);
  return withRv(e, userId);
}

export async function refreshRvNow(userId: string) {
  await refreshRv(true);
  const e = await ensureReady(userId);
  return withRv(e, userId);
}

export async function ackAlerts(userId: string, ids?: string[]) {
  const e = await ensureReady(userId);
  e.ackAlerts(ids);
  return withRv(e, userId);
}

export async function testAlert(userId: string) {
  const e = await ensureReady(userId);
  e.raise({
    severity: "critical",
    kind: "test",
    title: "Test fail-safe",
    detail: "Operator fired a test alert. Desktop, in-app, and webhook paths should fire.",
  });
  await flushNotify(e);
  return withRv(e, userId);
}

export async function tripNow(userId: string) {
  const e = await ensureReady(userId);
  await e.trip("circuit_open", "Operator tripped the fail-safe. All hedger orders cancelled, circuit open.");
  await flushNotify(e);
  return withRv(e, userId);
}

export async function setWebhook(userId: string, url: string | null) {
  const e = await ensureReady(userId);
  if (!url || !url.trim()) {
    e.webhookUrl = null;
    slot(userId).webhook = "";
    e.log("info", "Webhook cleared.");
    await persistIfAlive(userId);
    return withRv(e, userId);
  }
  e.webhookUrl = assertSafeWebhook(url);
  slot(userId).webhook = e.webhookUrl;
  e.log("info", `Webhook set · ${e.snapshot().webhookMasked}`);
  await persistIfAlive(userId);
  return withRv(e, userId);
}

export type { Alert };
