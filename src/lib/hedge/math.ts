import type { Currency, DeltaUnit, Greeks, Position, Side } from "./types";
import { PERP } from "./types";

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function roundTo(n: number, step: number) {
  if (step <= 0) return n;
  return Math.round(n / step) * step;
}

export function floorTo(n: number, step: number) {
  if (step <= 0) return n;
  return Math.floor(n / step) * step;
}

export function roundTick(price: number, tick: number) {
  return roundTo(price, tick);
}

export function normalCdf(x: number) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * z);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

export function normalPdf(x: number) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export type BsGreeks = {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  d1: number;
};

export function blackScholes(params: {
  spot: number;
  strike: number;
  tYears: number;
  vol: number;
  isCall: boolean;
  rate?: number;
}): BsGreeks {
  const { spot: S, strike: K, vol: sig, isCall } = params;
  const r = params.rate ?? 0;
  const T = Math.max(params.tYears, 1 / 365 / 24);
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sig * sig) * T) / (sig * sqrtT);
  const d2 = d1 - sig * sqrtT;
  const nd1 = normalPdf(d1);
  return {
    delta: isCall ? normalCdf(d1) : normalCdf(d1) - 1,
    gamma: nd1 / (S * sig * sqrtT),
    vega: (S * nd1 * sqrtT) / 100,
    theta:
      -S * nd1 * sig / (2 * sqrtT) / 365 +
      (isCall ? -r * K * Math.exp(-r * T) * normalCdf(d2) : r * K * Math.exp(-r * T) * normalCdf(-d2)) / 365,
    d1,
  };
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 1831565813) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randn(rng: () => number) {
  const u = Math.max(1e-12, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function makerPrice(args: {
  side: Side;
  bestBid: number;
  bestAsk: number;
  tick: number;
  offsetTicks: number;
}): number | null {
  const { side, bestBid, bestAsk, tick, offsetTicks } = args;
  if (!(bestBid > 0) || !(bestAsk > 0) || bestAsk <= bestBid) return null;
  if (side === "buy") {
    let px = roundTick(bestBid - offsetTicks * tick, tick);
    const cap = roundTick(bestAsk - tick, tick);
    if (px >= bestAsk) px = cap;
    if (px <= 0) return null;
    return px;
  }
  let px = roundTick(bestAsk + offsetTicks * tick, tick);
  const floor = roundTick(bestBid + tick, tick);
  if (px <= bestBid) px = floor;
  return px;
}

export function hedgeUsd(deltaCoin: number, index: number) {
  return -deltaCoin * index;
}

export function sumGreeks(positions: Position[], ccy: Currency): Greeks {
  let delta = 0;
  let gamma = 0;
  let vega = 0;
  let theta = 0;
  let optionDelta = 0;
  let perpDelta = 0;
  for (const p of positions) {
    if (p.currency !== ccy) continue;
    delta += p.delta;
    gamma += p.gamma;
    vega += p.vega;
    theta += p.theta;
    if (p.kind === "option" || p.kind === "option_combo") optionDelta += p.delta;
    else perpDelta += p.delta;
  }
  return { delta, gamma, vega, theta, optionDelta, perpDelta };
}

export function ddhCurrent(deltaCoin: number, index: number, unit: DeltaUnit) {
  return unit === "usd" ? deltaCoin * index : deltaCoin;
}

export function ddhThresholds(config: {
  threshold: Record<Currency, number>;
  thresholdPos?: Record<Currency, number>;
  thresholdNeg?: Record<Currency, number>;
}, ccy: Currency) {
  const fallback = config.threshold[ccy] ?? 0;
  return {
    pos: config.thresholdPos?.[ccy] ?? fallback,
    neg: config.thresholdNeg?.[ccy] ?? fallback,
  };
}

export function ddhFire(raw: number, posThr: number, negThr: number): "short" | "long" | null {
  if (raw >= posThr && raw > 0) return "short";
  if (-raw >= negThr && raw < 0) return "long";
  return null;
}

export function ddhHedgeUsd(args: {
  raw: number;
  index: number;
  ratio: number;
  unit: DeltaUnit;
}): number {
  const unitAmt = -args.ratio * args.raw;
  return args.unit === "usd" ? unitAmt : unitAmt * args.index;
}

export function splitNotional(absUsd: number, sliceUsd: number, minUsd: number): number[] {
  if (!(absUsd >= minUsd)) return [];
  const slice = sliceUsd > 0 ? Math.max(minUsd, sliceUsd) : absUsd;
  const parts: number[] = [];
  let left = absUsd;
  while (left >= minUsd - 1e-9) {
    const take = Math.min(slice, left);
    if (left - take > 0 && left - take < minUsd) {
      parts.push(floorTo(left, minUsd) || left);
      break;
    }
    const chunk = floorTo(take, minUsd) || take;
    if (chunk < minUsd) break;
    parts.push(chunk);
    left -= chunk;
    if (parts.length > 40) break;
  }
  return parts.filter((x) => x >= minUsd);
}

export function hedgeInstrument(
  config: { longInstrument?: Record<Currency, string>; shortInstrument?: Record<Currency, string> },
  ccy: Currency,
  fire: "short" | "long",
) {
  const inst = fire === "long" ? config.longInstrument?.[ccy] : config.shortInstrument?.[ccy];
  return inst && inst.length ? inst : PERP[ccy];
}

export function includedPositions(positions: Position[], hedgeFull: boolean, skip: string[]) {
  if (hedgeFull) return positions;
  const s = new Set(skip);
  return positions.filter((p) => !s.has(p.instrument));
}

export function deviationDelta(current: number, target: number) {
  const raw = current - target;
  return {
    raw,
    positive: Math.max(0, raw),
    negative: Math.max(0, -raw),
  };
}

export function bps(px: number, ref: number) {
  if (!ref) return 0;
  return ((px - ref) / ref) * 10_000;
}

export function captureBps(side: Side, fill: number, mid: number) {
  if (!mid || !fill) return 0;
  return ((side === "sell" ? fill - mid : mid - fill) / mid) * 10_000;
}

export function labelPrefix() {
  return "keel";
}

export function makeLabel(ccy: Currency, cycleId: number) {
  return `keel-${ccy}-${cycleId}`.slice(0, 32);
}

export function isKeelLabel(label: string) {
  return label.startsWith("keel-");
}

export function mean(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function rms(xs: number[]) {
  if (!xs.length) return 0;
  return Math.sqrt(xs.reduce((a, b) => a + b * b, 0) / xs.length);
}

const MONTHS: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

export function parseDeribitExpiry(s: string): number | null {
  const m = s.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/i);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = MONTHS[m[2]!.toUpperCase()];
  const year = 2000 + Number(m[3]);
  if (mon === undefined) return null;
  return Date.UTC(year, mon, day, 8, 0, 0);
}

export function parseOptionInstrument(name: string): {
  currency: Currency | null;
  expiryMs: number | null;
  strike: number | null;
  optionType: "call" | "put" | null;
} {
  const m = name.match(/^(BTC|ETH)-(\d{1,2}[A-Z]{3}\d{2})-(\d+)-([CP])$/i);
  if (!m) return { currency: null, expiryMs: null, strike: null, optionType: null };
  const currency = m[1]!.toUpperCase() as Currency;
  const optionType = m[4]!.toUpperCase() === "C" ? "call" : "put";
  const strike = Number(m[3]);
  return {
    currency,
    expiryMs: parseDeribitExpiry(m[2]!),
    strike,
    optionType,
  };
}
