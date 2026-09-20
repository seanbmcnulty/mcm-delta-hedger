import { PERP, type Currency } from "./types";
import {
  buildSurface,
  emptySurface,
  type OhlcBar,
  type RvSurface,
} from "./rv";

type Cache = {
  BTC: RvSurface;
  ETH: RvSurface;
  at: number;
  loading: Promise<void> | null;
  lastAttempt: number;
};

const g = globalThis as typeof globalThis & { __keelRv?: Cache; __keelRvRev?: number };
const RV_REV = 4;

const TTL_MS = 10 * 60_000;
const BASE = "https://www.deribit.com";

async function chartChunk(
  instrument: string,
  resolution: string,
  fromSec: number,
  toSec: number,
): Promise<OhlcBar[]> {
  const q = new URLSearchParams({
    instrument_name: instrument,
    resolution,
    start_timestamp: String(fromSec * 1000),
    end_timestamp: String(toSec * 1000),
  });
  const res = await fetch(`${BASE}/api/v2/public/get_tradingview_chart_data?${q}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  const json = (await res.json()) as {
    result?: {
      ticks?: number[];
      open?: number[];
      high?: number[];
      low?: number[];
      close?: number[];
      status?: string;
    };
    error?: { message: string };
  };
  if (json.error) throw new Error(json.error.message);
  const r = json.result;
  if (!r?.ticks?.length || r.status === "no_data") return [];
  const out: OhlcBar[] = [];
  for (let i = 0; i < r.ticks.length; i++) {
    const c = r.close?.[i];
    if (!c) continue;
    out.push({
      t: Math.floor(r.ticks[i]! / 1000),
      o: r.open?.[i] ?? c,
      h: r.high?.[i] ?? c,
      l: r.low?.[i] ?? c,
      c,
    });
  }
  return out;
}

async function fetchRange(instrument: string, resolution: string, days: number): Promise<OhlcBar[]> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;
  const resMin = resolution === "1D" ? 1440 : Number(resolution);
  const maxBars = 4000;
  const span = maxBars * resMin * 60;
  const windows: Array<[number, number]> = [];
  for (let t = from; t < to; t += span) windows.push([t, Math.min(t + span, to)]);
  const bars: OhlcBar[] = [];
  for (let i = 0; i < windows.length; i += 3) {
    const batch = windows.slice(i, i + 3);
    const parts = await Promise.all(
      batch.map(([a, b]) => chartChunk(instrument, resolution, a, b).catch(() => [] as OhlcBar[])),
    );
    for (const p of parts) bars.push(...p);
  }
  bars.sort((a, b) => a.t - b.t);
  const uniq: OhlcBar[] = [];
  let last = -1;
  for (const b of bars) {
    if (b.t === last) continue;
    last = b.t;
    uniq.push(b);
  }
  return uniq;
}

async function barsFor(ccy: Currency): Promise<OhlcBar[]> {
  const inst = PERP[ccy];
  const [m1, m5] = await Promise.all([
    fetchRange(inst, "1", 30),
    fetchRange(inst, "5", 30),
  ]);
  if (!m1.length) return m5;
  if (!m5.length) return m1;
  // Always keep 1m where it exists; prepend 5m only for the uncovered tail.
  // Do not prefer the longer 1m array — 14d of 1m is more points than 30d of 5m
  // and used to drop the tail, blanking the 21d/30d columns.
  const cut = m1[0]!.t;
  return [...m5.filter((b) => b.t < cut - 30), ...m1];
}

async function compute(): Promise<{ BTC: RvSurface; ETH: RvSurface }> {
  const now = Math.floor(Date.now() / 1000);
  const [btc, eth] = await Promise.all([barsFor("BTC"), barsFor("ETH")]);
  return {
    BTC: btc.length ? buildSurface("BTC", btc, now) : emptySurface("BTC"),
    ETH: eth.length ? buildSurface("ETH", eth, now) : emptySurface("ETH"),
  };
}

export function getRvCache(): { BTC: RvSurface; ETH: RvSurface } | null {
  const c = g.__keelRv;
  if (!c || !c.at) return null;
  return { BTC: c.BTC, ETH: c.ETH };
}

export function refreshRv(force = false): Promise<void> {
  if (!g.__keelRv || g.__keelRvRev !== RV_REV) {
    g.__keelRv = {
      BTC: emptySurface("BTC"),
      ETH: emptySurface("ETH"),
      at: 0,
      loading: null,
      lastAttempt: 0,
    };
    g.__keelRvRev = RV_REV;
  }
  const c = g.__keelRv;
  if (!force && c.at && Date.now() - c.at < TTL_MS) return c.loading ?? Promise.resolve();
  if (!force && c.loading) return c.loading;
  if (!force && !c.at && c.lastAttempt && Date.now() - c.lastAttempt < 20_000) return Promise.resolve();
  c.lastAttempt = Date.now();
  c.loading = compute()
    .then((s) => {
      c.BTC = s.BTC;
      c.ETH = s.ETH;
      if (s.BTC.asOf || s.ETH.asOf) c.at = Date.now();
    })
    .catch(() => {
      /* keep previous */
    })
    .finally(() => {
      c.loading = null;
    });
  return c.loading;
}
