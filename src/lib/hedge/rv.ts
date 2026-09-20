export type FreqId = "1m" | "5m" | "10m" | "15m" | "30m" | "1h" | "2h" | "12h" | "1d";
export type LookbackId = "1d" | "3d" | "7d" | "14d" | "21d" | "30d";

export type RvSurface = {
  currency: "BTC" | "ETH";
  cells: Record<string, number | null>;
  min: number;
  max: number;
  bestByLookback: Record<LookbackId, { freqId: FreqId; rv: number } | null>;
  asOf: number;
  coverageSec: number;
};

export const CHECK_INTERVALS: { sec: number; label: string }[] = [
  { sec: 5, label: "5s" },
  { sec: 10, label: "10s" },
  { sec: 30, label: "30s" },
  { sec: 60, label: "1m" },
  { sec: 300, label: "5m" },
  { sec: 600, label: "10m" },
  { sec: 900, label: "15m" },
  { sec: 1800, label: "30m" },
  { sec: 3600, label: "1h" },
];

export const HEDGE_FREQS: { id: FreqId; sec: number; label: string }[] = [
  { id: "1m", sec: 60, label: "1m" },
  { id: "5m", sec: 300, label: "5m" },
  { id: "10m", sec: 600, label: "10m" },
  { id: "15m", sec: 900, label: "15m" },
  { id: "30m", sec: 1800, label: "30m" },
  { id: "1h", sec: 3600, label: "1h" },
  { id: "2h", sec: 7200, label: "2h" },
  { id: "12h", sec: 43200, label: "12h" },
  { id: "1d", sec: 86400, label: "1d" },
];

export const LOOKBACKS: { id: LookbackId; sec: number; label: string }[] = [
  { id: "1d", sec: 86_400, label: "1d" },
  { id: "3d", sec: 259_200, label: "3d" },
  { id: "7d", sec: 604_800, label: "7d" },
  { id: "14d", sec: 1_209_600, label: "14d" },
  { id: "21d", sec: 1_814_400, label: "21d" },
  { id: "30d", sec: 2_592_000, label: "30d" },
];

export type OhlcBar = { t: number; o: number; h: number; l: number; c: number };

export function cellKey(freq: FreqId, lb: LookbackId) {
  return `${freq}|${lb}`;
}

export function freqFromSec(sec: number): FreqId {
  let best: FreqId = "1m";
  let dist = Infinity;
  for (const f of HEDGE_FREQS) {
    const d = Math.abs(f.sec - sec);
    if (d < dist) {
      dist = d;
      best = f.id;
    }
  }
  return best;
}

export function secFromFreq(id: FreqId) {
  return HEDGE_FREQS.find((f) => f.id === id)?.sec ?? 60;
}

export function formatInterval(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec % 86400 === 0) return `${sec / 86400}d`;
  if (sec % 3600 === 0) return `${sec / 3600}h`;
  if (sec % 60 === 0) return `${sec / 60}m`;
  return `${sec}s`;
}

export function snapInterval(sec: number) {
  const allowed = [...CHECK_INTERVALS.map((x) => x.sec), ...HEDGE_FREQS.map((f) => f.sec)];
  let best = allowed[0] ?? 5;
  let dist = Infinity;
  for (const s of allowed) {
    const d = Math.abs(s - sec);
    if (d < dist) {
      dist = d;
      best = s;
    }
  }
  return best;
}

function resample(bars: OhlcBar[], bucketSec: number): OhlcBar[] {
  if (!bars.length) return [];
  const out: OhlcBar[] = [];
  let bucket = -1;
  let cur: OhlcBar | null = null;
  for (const b of bars) {
    const k = Math.floor(b.t / bucketSec);
    if (k !== bucket) {
      if (cur) out.push(cur);
      bucket = k;
      cur = { t: k * bucketSec, o: b.o, h: b.h, l: b.l, c: b.c };
    } else if (cur) {
      cur.h = Math.max(cur.h, b.h);
      cur.l = Math.min(cur.l, b.l);
      cur.c = b.c;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function closeToClose(bars: OhlcBar[], dtSec: number) {
  let ss = 0;
  let n = 0;
  for (let i = 1; i < bars.length; i++) {
    const a = bars[i - 1]!.c;
    const b = bars[i]!.c;
    if (a > 0 && b > 0) {
      const r = Math.log(b / a);
      ss += r * r;
      n += 1;
    }
  }
  if (n < 8) return null;
  const ppy = (365 * 24 * 3600) / dtSec;
  return Math.sqrt((ss / n) * ppy) * 100;
}

function parkinson(bars: OhlcBar[], dtSec: number) {
  let ss = 0;
  let n = 0;
  const den = 4 * Math.log(2);
  for (const b of bars) {
    if (b.h > 0 && b.l > 0 && b.h >= b.l) {
      const x = Math.log(b.h / b.l);
      ss += (x * x) / den;
      n += 1;
    }
  }
  if (n < 8) return null;
  const ppy = (365 * 24 * 3600) / dtSec;
  return Math.sqrt((ss / n) * ppy) * 100;
}

export function compositeRv(bars: OhlcBar[], dtSec: number): number | null {
  const cc = closeToClose(bars, dtSec);
  const pk = parkinson(bars, dtSec);
  if (cc === null && pk === null) return null;
  if (cc === null) return pk;
  if (pk === null) return cc;
  return (cc + pk) / 2;
}

export function buildSurface(currency: "BTC" | "ETH", bars: OhlcBar[], asOf: number): RvSurface {
  const sorted = [...bars].sort((a, b) => a.t - b.t);
  const coverageSec = sorted.length ? sorted[sorted.length - 1]!.t - sorted[0]!.t : 0;
  const cells: Record<string, number | null> = {};
  const bestByLookback = {} as RvSurface["bestByLookback"];
  const vals: number[] = [];

  for (const lb of LOOKBACKS) {
    const window = sorted.filter((b) => b.t >= asOf - lb.sec);
    for (const freq of HEDGE_FREQS) {
      const sampled = resample(window, freq.sec);
      const span = sampled.length > 1 ? sampled[sampled.length - 1]!.t - sampled[0]!.t : 0;
      const impliedDt = sampled.length > 1 ? span / (sampled.length - 1) : Infinity;
      const need = Math.max(10, Math.floor(lb.sec / freq.sec) * 0.55);
      let rv: number | null = null;
      if (sampled.length >= need && impliedDt <= freq.sec * 2.2) rv = compositeRv(sampled, freq.sec);
      cells[cellKey(freq.id, lb.id)] = rv;
      if (rv !== null) vals.push(rv);
    }
    bestByLookback[lb.id] = minRvForLookback({ cells }, lb.id);
  }

  return {
    currency,
    cells,
    min: vals.length ? Math.min(...vals) : 30,
    max: vals.length ? Math.max(...vals) : 50,
    bestByLookback,
    asOf,
    coverageSec,
  };
}

export function minRvForLookback(
  surface: Pick<RvSurface, "cells">,
  lb: LookbackId,
): { freqId: FreqId; rv: number } | null {
  let best: { freqId: FreqId; rv: number } | null = null;
  for (const freq of HEDGE_FREQS) {
    const rv = surface.cells[cellKey(freq.id, lb)];
    if (typeof rv === "number" && Number.isFinite(rv) && (!best || rv < best.rv)) {
      best = { freqId: freq.id, rv };
    }
  }
  return best;
}

export function emptySurface(currency: "BTC" | "ETH"): RvSurface {
  const cells: Record<string, number | null> = {};
  const bestByLookback = {} as RvSurface["bestByLookback"];
  for (const lb of LOOKBACKS) {
    bestByLookback[lb.id] = null;
    for (const f of HEDGE_FREQS) cells[cellKey(f.id, lb.id)] = null;
  }
  return { currency, cells, min: 30, max: 50, bestByLookback, asOf: 0, coverageSec: 0 };
}
