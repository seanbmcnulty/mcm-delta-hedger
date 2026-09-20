import { DEFAULT_CONFIG, type CycleRecord, type HedgeConfig, type PolicyChange, type QualityBreakdown, type Counterfactual, type Currency, type SeriesPoint } from "./types";
import { clamp, mean, rms } from "./math";

export function qualityFromCycles(cycles: CycleRecord[]): QualityBreakdown {
  const done = cycles.filter((c) => c.endedAt);
  const n = done.length;
  if (!n) return { score: 0, fill: 0, capture: 0, residual: 0, adverse: 0, n: 0 };
  const fill = mean(done.map((c) => c.fillRate));
  const captures = done.map((c) => c.captureBps).filter((x): x is number => x !== null);
  const adverses = done.map((c) => c.adverseBps).filter((x): x is number => x !== null);
  const capture = captures.length ? mean(captures) : 0;
  const adverse = adverses.length ? mean(adverses) : 0;
  const residual = mean(done.map((c) => Math.abs(c.endDelta ?? c.startDelta)));
  const fillScore = clamp(fill, 0, 1);
  const captureScore = clamp(0.5 + capture / 6, 0, 1);
  const residualScore = clamp(1 - residual / 0.4, 0, 1);
  const adverseScore = clamp(1 - Math.max(0, adverse) / 8, 0, 1);
  const score =
    100 * (0.28 * fillScore + 0.22 * captureScore + 0.28 * residualScore + 0.22 * adverseScore);
  return { score, fill, capture, residual, adverse, n };
}

export function suggestionsFrom(args: {
  quality: QualityBreakdown;
  config: HedgeConfig;
  gamma: Record<Currency, number>;
}): string[] {
  const { quality: q, config, gamma } = args;
  const out: string[] = [];
  if (q.n < 4) {
    out.push("Need a handful of completed cycles before the tuner can speak with any confidence.");
    return out;
  }
  if (q.fill < 0.4) {
    out.push(
      `Maker fill rate is ${(q.fill * 100).toFixed(0)}%. Tighten quoteOffsetTicks (currently ${config.quoteOffsetTicks}) or lengthen the cycle so quotes rest longer.`,
    );
  } else if (q.fill > 0.88 && q.adverse > 1.2) {
    out.push(
      `Fills are fast but adverse selection is ${q.adverse.toFixed(2)} bp. Step back a tick — you are being sniped at the touch.`,
    );
  }
  if (q.capture < -0.4) {
    out.push(
      `Average capture ${q.capture.toFixed(2)} bp is negative — fills are through the mid. Stay post-only and do not chase.`,
    );
  } else if (q.capture > 0.6) {
    out.push(`Earning ${q.capture.toFixed(2)} bp vs mid. Passive quoting is paying for itself.`);
  }
  const gBtc = Math.abs(gamma.BTC);
  const gEth = Math.abs(gamma.ETH);
  const impliedMin = gBtc > 0.0004 || gEth > 0.008 ? 20 : 45;
  if (config.intervalSec > impliedMin * 1.6 && (gBtc > 0.0003 || gEth > 0.005)) {
    out.push(
      `Short gamma is material (BTC γ ${gamma.BTC.toFixed(5)}, ETH γ ${gamma.ETH.toFixed(4)}). A ${config.intervalSec}s cycle leaves delta to run — try ~${impliedMin}s.`,
    );
  }
  if (q.residual > 0.15) {
    out.push("Residual after clocks is still large. Shorten the interval or raise hedge %.");
  }
  if (q.n >= 8 && q.score > 78 && config.intervalSec < 90 && gBtc < 0.0002) {
    out.push("Quiet book and high score — you can lengthen the interval and save on turnover.");
  }
  if (!out.length) out.push("Policy looks balanced. Leave auto-tune on and re-evaluate after another hour.");
  return out.slice(0, 4);
}

export function autoTune(
  config: HedgeConfig,
  quality: QualityBreakdown,
  gamma: Record<Currency, number>,
  now: number,
): { config: HedgeConfig; changes: PolicyChange[] } {
  if (!config.autoTune || quality.n < 6) return { config, changes: [] };
  const next: HedgeConfig = {
    ...config,
    threshold: { ...config.threshold },
    thresholdPos: { ...config.thresholdPos },
    thresholdNeg: { ...config.thresholdNeg },
    maxHedgeUsd: { ...config.maxHedgeUsd },
    targetDelta: { ...config.targetDelta },
    currencies: [...config.currencies],
    hedgeSkip: [...(config.hedgeSkip ?? [])],
    longInstrument: { ...config.longInstrument },
    shortInstrument: { ...config.shortInstrument },
    orderAmountCoin: { ...config.orderAmountCoin },
  };
  const changes: PolicyChange[] = [];

  const bump = (
    field: string,
    from: number,
    to: number,
    reason: string,
    apply: () => void,
  ) => {
    if (from === to) return;
    apply();
    changes.push({ t: now, field, from, to, reason });
  };

  if (quality.fill < 0.38 && next.quoteOffsetTicks > -2) {
    const from = next.quoteOffsetTicks;
    bump("quoteOffsetTicks", from, from - 1, "Low maker fill rate — tightening quotes", () => {
      next.quoteOffsetTicks = from - 1;
    });
  } else if (quality.fill > 0.86 && quality.adverse > 1.4 && next.quoteOffsetTicks < 3) {
    const from = next.quoteOffsetTicks;
    bump(
      "quoteOffsetTicks",
      from,
      from + 1,
      "Adverse selection after quick fills — stepping back a tick",
      () => {
        next.quoteOffsetTicks = from + 1;
      },
    );
  }

  const hotGamma = Math.abs(gamma.BTC) > 0.00035 || Math.abs(gamma.ETH) > 0.007;
  if (config.freqPolicy !== "min_rv") {
    if (quality.residual > 0.08 && hotGamma && next.intervalSec > 60) {
      const from = next.intervalSec;
      const to = Math.max(60, Math.round(from * 0.75));
      bump("intervalSec", from, to, "Residual delta too large versus gamma — shortening cycle", () => {
        next.intervalSec = to;
      });
    } else if (quality.residual < 0.012 && !hotGamma && next.intervalSec < 3600) {
      const from = next.intervalSec;
      const to = Math.min(86400, Math.round(from * 1.15));
      bump("intervalSec", from, to, "Quiet residual — lengthening cycle to cut turnover", () => {
        next.intervalSec = to;
      });
    }
  }

  return { config: next, changes };
}

export function counterfactuals(series: SeriesPoint[]): Counterfactual[] {
  if (series.length < 8) return [];
  const intervals = [15, 30, 60, 120, 300];
  const out: Counterfactual[] = [];
  for (const intervalSec of intervals) {
    let lastHedgeT = series[0]!.t;
    let btcPerp = 0;
    let ethPerp = 0;
    let cost = 0;
    let nHedges = 0;
    const residuals: number[] = [];
    const spreadBps = 0.8;
    for (const p of series) {
      const optBtc = p.btcDelta - btcPerp;
      const optEth = p.ethDelta - ethPerp;
      if (p.t - lastHedgeT >= intervalSec * 1000) {
        const halfBtc = p.btcIndex * (spreadBps / 10_000) * 0.5;
        const halfEth = p.ethIndex * (spreadBps / 10_000) * 0.5;
        cost += Math.abs(optBtc) * halfBtc + Math.abs(optEth) * halfEth;
        btcPerp += -optBtc;
        ethPerp += -optEth;
        nHedges += 1;
        lastHedgeT = p.t;
      }
      residuals.push(Math.abs(optBtc) + Math.abs(optEth) * 0.05);
    }
    out.push({ intervalSec, estCostUsd: cost, residualRms: rms(residuals), nHedges });
  }
  return out;
}

export function restoreConfig(): HedgeConfig {
  return {
    ...DEFAULT_CONFIG,
    threshold: { ...DEFAULT_CONFIG.threshold },
    thresholdPos: { ...DEFAULT_CONFIG.thresholdPos },
    thresholdNeg: { ...DEFAULT_CONFIG.thresholdNeg },
    maxHedgeUsd: { ...DEFAULT_CONFIG.maxHedgeUsd },
    targetDelta: { ...DEFAULT_CONFIG.targetDelta },
    currencies: [...DEFAULT_CONFIG.currencies],
    hedgeSkip: [...DEFAULT_CONFIG.hedgeSkip],
    longInstrument: { ...DEFAULT_CONFIG.longInstrument },
    shortInstrument: { ...DEFAULT_CONFIG.shortInstrument },
    orderAmountCoin: { ...DEFAULT_CONFIG.orderAmountCoin },
  };
}

export function coachPrompt(payload: {
  quality: QualityBreakdown;
  config: HedgeConfig;
  suggestions: string[];
  cycles: CycleRecord[];
  gamma: Record<Currency, number>;
  counterfactuals: Counterfactual[];
}) {
  const recent = payload.cycles.slice(-12).map((c) => ({
    ccy: c.currency,
    start: Number(c.startDelta.toFixed(4)),
    end: c.endDelta === null ? null : Number(c.endDelta.toFixed(4)),
    fillRate: Number(c.fillRate.toFixed(2)),
    captureBps: c.captureBps === null ? null : Number(c.captureBps.toFixed(2)),
    adverseBps: c.adverseBps === null ? null : Number(c.adverseBps.toFixed(2)),
    filledUsd: Math.round(c.filledUsd),
  }));
  return `You are a crypto options MM coach reviewing a maker-only portfolio delta hedge on Deribit (BTC & ETH perps, post-only).
Be terse, numeric, and opinionated. No fluff. 3-6 short bullets plus one recommended next change.

Config: ${JSON.stringify(payload.config)}
Quality: ${JSON.stringify(payload.quality)}
Gamma: ${JSON.stringify(payload.gamma)}
Heuristic notes: ${JSON.stringify(payload.suggestions)}
Interval counterfactuals (half-spread cost vs residual): ${JSON.stringify(payload.counterfactuals)}
Recent cycles: ${JSON.stringify(recent)}`;
}
