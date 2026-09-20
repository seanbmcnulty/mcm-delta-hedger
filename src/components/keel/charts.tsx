import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OrderBook, QualityBreakdown, Snapshot } from "@/lib/hedge/types";
import { fmtBps, fmtDelta, fmtNum, fmtTime, fmtUsd } from "./format";

const axis = { fontSize: 11, fill: "var(--color-subtle)", fontFamily: "var(--font-mono)" };
const grid = { stroke: "color-mix(in oklab, var(--color-fg) 8%, transparent)" };

function ChartTip({
  active,
  payload,
  label,
  labels,
  formats,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string | number;
  labels?: Record<string, string>;
  formats?: Record<string, (v: number) => string>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md bg-surface-2 px-2.5 py-2 text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.1)]">
      <div className="mb-1 font-mono text-subtle">{typeof label === "number" ? fmtTime(label) : label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4 font-mono">
          <span className="text-muted">{labels?.[p.name] ?? p.name}</span>
          <span className="text-fg">{(formats?.[p.name] ?? ((v: number) => fmtNum(v, 3)))(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

export function DdhDeltaChart({
  series,
  ccy,
  target,
  thresholdPos,
  thresholdNeg,
  hedges,
}: {
  series: Snapshot["series"];
  ccy: "BTC" | "ETH";
  target: number;
  thresholdPos: number;
  thresholdNeg: number;
  hedges?: number[];
}) {
  const data = series.map((p) => ({
    t: p.t,
    delta: ccy === "BTC" ? p.btcDelta : p.ethDelta,
    perp: ccy === "BTC" ? p.btcIndex : p.ethIndex,
  }));
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted md:h-72">
        Warming marks…
      </div>
    );
  }
  const lo = target - thresholdNeg;
  const hi = target + thresholdPos;
  const marks = (hedges ?? []).slice(0, 24);
  const pxDigits = ccy === "BTC" ? 0 : 1;
  return (
    <div className="h-64 w-full md:h-72">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid.stroke} />
          <XAxis dataKey="t" tickFormatter={fmtTime} tick={axis} minTickGap={48} />
          <YAxis
            yAxisId="delta"
            tick={axis}
            tickFormatter={(v) => fmtNum(v, 2)}
            width={56}
            domain={["auto", "auto"]}
          />
          <YAxis
            yAxisId="perp"
            orientation="right"
            tick={axis}
            tickFormatter={(v) => fmtNum(v, pxDigits)}
            width={64}
            domain={["auto", "auto"]}
          />
          <RTooltip
            content={
              <ChartTip
                labels={{ delta: "Δ Total", perp: `${ccy}-PERP` }}
                formats={{
                  delta: (v) => fmtNum(v, 3),
                  perp: (v) => fmtUsd(v, pxDigits),
                }}
              />
            }
          />
          <ReferenceArea yAxisId="delta" y1={lo} y2={hi} fill="var(--color-long)" fillOpacity={0.06} ifOverflow="extendDomain" />
          <ReferenceLine yAxisId="delta" y={target} stroke="var(--color-muted)" strokeDasharray="4 4" />
          {marks.map((t) => (
            <ReferenceLine key={t} yAxisId="delta" x={t} stroke="var(--color-border)" strokeDasharray="2 4" />
          ))}
          <Line
            yAxisId="delta"
            type="monotone"
            dataKey="delta"
            stroke={ccy === "BTC" ? "var(--color-btc)" : "var(--color-eth)"}
            dot={false}
            strokeWidth={1.8}
            isAnimationActive={false}
          />
          <Line
            yAxisId="perp"
            type="monotone"
            dataKey="perp"
            stroke="var(--color-warn)"
            dot={false}
            strokeWidth={1.4}
            strokeDasharray="5 3"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DeltaChart({ series }: { series: Snapshot["series"] }) {
  const data = series.map((p) => ({ t: p.t, btc: p.btcDelta, eth: p.ethDelta }));
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid.stroke} />
          <XAxis dataKey="t" tickFormatter={fmtTime} tick={axis} minTickGap={48} />
          <YAxis tick={axis} tickFormatter={(v) => fmtNum(v, 2)} width={56} />
          <RTooltip content={<ChartTip labels={{ btc: "BTC Δ", eth: "ETH Δ" }} />} />
          <Line type="monotone" dataKey="btc" stroke="var(--color-btc)" dot={false} strokeWidth={1.6} isAnimationActive={false} />
          <Line type="monotone" dataKey="eth" stroke="var(--color-eth)" dot={false} strokeWidth={1.6} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PnlChart({ series }: { series: Snapshot["series"] }) {
  const data = series.map((p) => ({ t: p.t, unhedged: p.unhedgedUsd, hedged: p.hedgedUsd }));
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid.stroke} />
          <XAxis dataKey="t" tickFormatter={fmtTime} tick={axis} minTickGap={48} />
          <YAxis tick={axis} tickFormatter={(v) => fmtUsd(v)} width={64} />
          <RTooltip content={<ChartTip labels={{ unhedged: "Naked options", hedged: "After perp" }} />} />
          <Area type="monotone" dataKey="unhedged" stroke="var(--color-short)" fill="var(--color-short)" fillOpacity={0.12} isAnimationActive={false} />
          <Area type="monotone" dataKey="hedged" stroke="var(--color-long)" fill="var(--color-long)" fillOpacity={0.12} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ResidualBars({ cycles }: { cycles: Snapshot["cycles"] }) {
  const data = [...cycles]
    .filter((c) => c.endedAt)
    .slice(0, 24)
    .reverse()
    .map((c) => ({
      name: `${c.currency[0]}${c.id}`,
      residual: c.endDelta ?? 0,
      fill: Math.abs(c.endDelta ?? 0),
    }));
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid.stroke} />
          <XAxis dataKey="name" tick={axis} />
          <YAxis tick={axis} tickFormatter={(v) => fmtDelta(v)} width={64} />
          <RTooltip content={<ChartTip labels={{ residual: "Residual Δ" }} />} />
          <Bar dataKey="residual" isAnimationActive={false} radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.residual >= 0 ? "var(--color-long)" : "var(--color-short)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FillScatter({ cycles }: { cycles: Snapshot["cycles"] }) {
  const data = cycles
    .filter((c) => c.captureBps !== null)
    .map((c) => ({
      x: c.captureBps ?? 0,
      y: c.adverseBps ?? 0,
      z: c.fillRate,
      ccy: c.currency,
    }));
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid.stroke} />
          <XAxis dataKey="x" name="capture" tick={axis} tickFormatter={(v) => `${v}bp`} />
          <YAxis dataKey="y" name="adverse" tick={axis} tickFormatter={(v) => `${v}bp`} width={56} />
          <RTooltip
            content={({ payload }) => {
              const p = payload?.[0]?.payload as { x: number; y: number; ccy: string } | undefined;
              if (!p) return null;
              return (
                <div className="rounded-md bg-surface-2 px-2.5 py-2 font-mono text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.1)]">
                  <div>{p.ccy}</div>
                  <div>capture {fmtBps(p.x)}</div>
                  <div>adverse {fmtBps(p.y)}</div>
                </div>
              );
            }}
          />
          <Scatter data={data} fill="var(--color-btc)" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IntervalBars({ rows }: { rows: Snapshot["counterfactuals"] }) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid.stroke} />
          <XAxis dataKey="intervalSec" tick={axis} tickFormatter={(v) => `${v}s`} />
          <YAxis yAxisId="l" tick={axis} tickFormatter={(v) => fmtUsd(v)} width={56} />
          <YAxis yAxisId="r" orientation="right" tick={axis} width={48} />
          <RTooltip content={<ChartTip labels={{ estCostUsd: "Est. cost $", residualRms: "Residual RMS" }} />} />
          <Bar yAxisId="l" dataKey="estCostUsd" fill="var(--color-muted)" isAnimationActive={false} radius={[3, 3, 0, 0]} />
          <Bar yAxisId="r" dataKey="residualRms" fill="var(--color-eth)" isAnimationActive={false} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BookLadder({ book }: { book: OrderBook | undefined }) {
  if (!book) {
    return <p className="py-8 text-center text-sm text-muted">No book yet.</p>;
  }
  const spread = book.bestAsk - book.bestBid;
  const spreadBps = book.mid ? (spread / book.mid) * 10_000 : 0;
  return (
    <div className="font-mono text-sm">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">Mid</div>
          <div className="text-xl tabular-nums">{fmtNum(book.mid, 2)}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">Spread</div>
          <div className="tabular-nums text-muted">{fmtNum(spread, 2)} · {fmtBps(spreadBps)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-long/10 px-3 py-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-long">Bid</div>
          <div className="mt-1 text-lg tabular-nums text-long">{fmtNum(book.bestBid, 2)}</div>
          <div className="text-xs text-muted tabular-nums">{fmtUsd(book.bidSize)}</div>
        </div>
        <div className="rounded-lg bg-short/10 px-3 py-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-short">Ask</div>
          <div className="mt-1 text-lg tabular-nums text-short">{fmtNum(book.bestAsk, 2)}</div>
          <div className="text-xs text-muted tabular-nums">{fmtUsd(book.askSize)}</div>
        </div>
      </div>
    </div>
  );
}

export function ScoreRing({ quality }: { quality: QualityBreakdown }) {
  const score = Math.round(quality.score);
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.16em] text-subtle">Hedge quality</div>
        <div className="mt-1 font-mono text-4xl tabular-nums tracking-tight">{quality.n ? score : "—"}</div>
        <div className="text-xs text-muted">{quality.n} completed cycles</div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
        <span className="text-subtle">Fill</span>
        <span className="tabular-nums text-right">{(quality.fill * 100).toFixed(0)}%</span>
        <span className="text-subtle">Capture</span>
        <span className="tabular-nums text-right">{fmtBps(quality.capture)}</span>
        <span className="text-subtle">Residual</span>
        <span className="tabular-nums text-right">{fmtNum(quality.residual, 3)}</span>
        <span className="text-subtle">Adverse</span>
        <span className="tabular-nums text-right">{fmtBps(quality.adverse)}</span>
      </div>
    </div>
  );
}
