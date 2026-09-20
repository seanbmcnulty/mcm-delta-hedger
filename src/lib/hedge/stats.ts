import type { CycleRecord, SeriesPoint } from "./types";
import { cellKey, freqFromSec, type FreqId, type LookbackId, type RvSurface } from "./rv";

const ANN = 365 * 24 * 3600;

export type FillPoint = {
  t: number;
  label: string;
  ccy: string;
  fill: number;
  capture: number;
  adverse: number;
  filledUsd: number;
  residual: number;
  cumUsd: number;
  startDelta: number;
};

export function fillPath(cycles: CycleRecord[]): FillPoint[] {
  const done = [...cycles].filter((c) => c.endedAt).sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0));
  let cum = 0;
  return done.map((c) => {
    cum += Math.abs(c.filledUsd);
    return {
      t: c.endedAt ?? c.startedAt,
      label: `${c.currency[0]}${c.id}`,
      ccy: c.currency,
      fill: c.fillRate * 100,
      capture: c.captureBps ?? 0,
      adverse: c.adverseBps ?? 0,
      filledUsd: c.filledUsd,
      residual: c.endDelta ?? 0,
      cumUsd: cum,
      startDelta: c.startDelta,
    };
  });
}

export type HistBin = { x: string; n: number; lo: number };

export function captureHist(cycles: CycleRecord[], width = 1): HistBin[] {
  const xs = cycles.map((c) => c.captureBps).filter((x): x is number => x !== null && Number.isFinite(x));
  const lo = -8;
  const hi = 8;
  const bins: HistBin[] = [];
  for (let e = lo; e < hi; e += width) {
    bins.push({ x: `${e > 0 ? "+" : ""}${e}`, n: 0, lo: e });
  }
  for (const v of xs) {
    const clamped = Math.min(hi - width, Math.max(lo, v));
    const i = Math.floor((clamped - lo) / width);
    const b = bins[i];
    if (b) b.n += 1;
  }
  return bins;
}

function medianDt(ts: number[]) {
  if (ts.length < 2) return 2;
  const dts: number[] = [];
  for (let i = 1; i < ts.length; i++) dts.push((ts[i]! - ts[i - 1]!) / 1000);
  dts.sort((a, b) => a - b);
  return Math.max(1, dts[Math.floor(dts.length / 2)] ?? 2);
}

function ccRvFromPrices(px: number[], dtSec: number): number | null {
  if (px.length < 8) return null;
  let ss = 0;
  let n = 0;
  for (let i = 1; i < px.length; i++) {
    const a = px[i - 1]!;
    const b = px[i]!;
    if (a > 0 && b > 0) {
      const r = Math.log(b / a);
      ss += r * r;
      n += 1;
    }
  }
  if (n < 6) return null;
  return Math.sqrt((ss / n) * (ANN / dtSec)) * 100;
}

function resampleCloses(series: SeriesPoint[], key: "btcIndex" | "ethIndex", bucketSec: number) {
  const out: { t: number; c: number }[] = [];
  let bucket = -1;
  for (const p of series) {
    const px = p[key];
    if (!(px > 0)) continue;
    const k = Math.floor(p.t / 1000 / bucketSec);
    if (k !== bucket) {
      out.push({ t: k * bucketSec, c: px });
      bucket = k;
    } else if (out.length) {
      out[out.length - 1]!.c = px;
    }
  }
  return out;
}

export function sessionRvAtFreq(series: SeriesPoint[], freqSec: number) {
  const btcBars = resampleCloses(series, "btcIndex", freqSec);
  const ethBars = resampleCloses(series, "ethIndex", freqSec);
  const nativeDt = medianDt(series.map((p) => p.t));
  const btcFreq = ccRvFromPrices(
    btcBars.map((b) => b.c),
    freqSec,
  );
  const ethFreq = ccRvFromPrices(
    ethBars.map((b) => b.c),
    freqSec,
  );
  const btcNative = ccRvFromPrices(
    series.map((p) => p.btcIndex).filter((x) => x > 0),
    nativeDt,
  );
  const ethNative = ccRvFromPrices(
    series.map((p) => p.ethIndex).filter((x) => x > 0),
    nativeDt,
  );
  return {
    btc: btcFreq ?? btcNative,
    eth: ethFreq ?? ethNative,
    atFreq: btcFreq != null && ethFreq != null,
    n: Math.max(btcBars.length, series.length),
  };
}

export function rollingIndexRv(series: SeriesPoint[], _freqSec: number, windowSec = 120) {
  const out: { t: number; btc: number | null; eth: number | null }[] = [];
  if (series.length < 10) return out;
  for (let i = 9; i < series.length; i++) {
    const t0 = series[i]!.t - windowSec * 1000;
    const slice = series.filter((p) => p.t >= t0 && p.t <= series[i]!.t);
    if (slice.length < 8) continue;
    const dt = medianDt(slice.map((s) => s.t));
    out.push({
      t: series[i]!.t,
      btc: ccRvFromPrices(
        slice.map((s) => s.btcIndex),
        dt,
      ),
      eth: ccRvFromPrices(
        slice.map((s) => s.ethIndex),
        dt,
      ),
    });
  }
  return out;
}

function diffs(xs: number[]) {
  const out: number[] = [];
  for (let i = 1; i < xs.length; i++) out.push(xs[i]! - xs[i - 1]!);
  return out;
}

function rms(xs: number[]) {
  if (!xs.length) return 0;
  return Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length);
}

export function pathVol(series: SeriesPoint[]) {
  const naked = diffs(series.map((p) => p.unhedgedUsd));
  const hedged = diffs(series.map((p) => p.hedgedUsd));
  const nRms = rms(naked);
  const hRms = rms(hedged);
  return {
    nakedRms: nRms,
    hedgedRms: hRms,
    reduction: nRms > 1e-9 ? (1 - hRms / nRms) * 100 : null,
  };
}

export function rollingPathVol(series: SeriesPoint[], window = 40) {
  const out: { t: number; naked: number; hedged: number }[] = [];
  if (series.length < 8) return out;
  for (let i = 8; i < series.length; i++) {
    const slice = series.slice(Math.max(0, i - window), i + 1);
    const v = pathVol(slice);
    out.push({ t: series[i]!.t, naked: v.nakedRms, hedged: v.hedgedRms });
  }
  return out;
}

export function surfaceCell(surface: RvSurface | null | undefined, freq: FreqId, lookback: LookbackId) {
  if (!surface) return null;
  const v = surface.cells[cellKey(freq, lookback)];
  return typeof v === "number" ? v : null;
}

export function hedgeRvSummary(
  series: SeriesPoint[],
  intervalSec: number,
  rv: { BTC: RvSurface; ETH: RvSurface } | null,
  lookback: LookbackId,
) {
  const freq = freqFromSec(intervalSec);
  const session = sessionRvAtFreq(series, intervalSec);
  const vol = pathVol(series);
  return {
    freq,
    sessionBtc: session.btc,
    sessionEth: session.eth,
    atFreq: session.atFreq,
    surfaceBtc: surfaceCell(rv?.BTC, freq, lookback),
    surfaceEth: surfaceCell(rv?.ETH, freq, lookback),
    nakedRms: vol.nakedRms,
    hedgedRms: vol.hedgedRms,
    reduction: vol.reduction,
    samples: session.n,
  };
}
