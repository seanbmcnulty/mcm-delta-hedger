import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Snapshot } from "@/lib/hedge/types";
import { freqFromSec } from "@/lib/hedge/rv";
import {
  captureHist,
  fillPath,
  hedgeRvSummary,
  rollingIndexRv,
  rollingPathVol,
} from "@/lib/hedge/stats";
import { fmtBps, fmtNum, fmtPct, fmtTime, fmtUsd } from "./format";

const axis = { fontSize: 11, fill: "var(--color-subtle)", fontFamily: "var(--font-mono)" };
const grid = { stroke: "color-mix(in oklab, var(--color-fg) 8%, transparent)" };

function Tip({
  active,
  payload,
  label,
  labels,
  format,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string | number;
  labels?: Record<string, string>;
  format?: (n: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md bg-surface-2 px-2.5 py-2 text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.1)]">
      <div className="mb-1 font-mono text-subtle">{typeof label === "number" ? fmtTime(label) : label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4 font-mono">
          <span className="text-muted">{labels?.[p.name] ?? p.name}</span>
          <span className="text-fg">{format ? format(Number(p.value), p.name) : fmtNum(Number(p.value), 2)}</span>
        </div>
      ))}
    </div>
  );
}

export function HedgeRvStrip({ snap }: { snap: Snapshot }) {
  const s = hedgeRvSummary(snap.series, snap.config.intervalSec, snap.rv, snap.config.targetLookback);
  const items = [
    { k: s.atFreq ? `BTC RV @ ${s.freq}` : "BTC session RV", v: s.sessionBtc == null ? "—" : fmtPct(s.sessionBtc), sub: s.surfaceBtc == null ? "path" : `surface ${fmtPct(s.surfaceBtc)}` },
    { k: s.atFreq ? `ETH RV @ ${s.freq}` : "ETH session RV", v: s.sessionEth == null ? "—" : fmtPct(s.sessionEth), sub: s.surfaceEth == null ? "path" : `surface ${fmtPct(s.surfaceEth)}` },
    { k: "Naked $ rms", v: fmtUsd(s.nakedRms, 0), sub: "unhedged path" },
    { k: "Hedged $ rms", v: fmtUsd(s.hedgedRms, 0), sub: "after perps" },
    { k: "Vol taken out", v: s.reduction == null ? "—" : fmtPct(s.reduction, 0), sub: `${s.samples} buckets` },
    { k: "Hedge ratio", v: `${snap.config.hedgePct}%`, sub: "of Δ − Δ*" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <div key={it.k} className="rounded-xl bg-surface px-3 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
          <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">{it.k}</div>
          <div className="mt-1 font-mono text-xl tabular-nums">{it.v}</div>
          <div className="font-mono text-[11px] text-muted">{it.sub}</div>
        </div>
      ))}
    </div>
  );
}

export function SessionRvChart({ snap }: { snap: Snapshot }) {
  const data = rollingIndexRv(snap.series, snap.config.intervalSec);
  const freq = freqFromSec(snap.config.intervalSec);
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid.stroke} />
          <XAxis dataKey="t" tickFormatter={fmtTime} tick={axis} minTickGap={48} />
          <YAxis tick={axis} tickFormatter={(v) => `${fmtNum(v, 0)}%`} width={48} />
          <RTooltip content={<Tip labels={{ btc: `BTC ${freq}`, eth: `ETH ${freq}` }} format={(n) => fmtPct(n)} />} />
          <Line type="monotone" dataKey="btc" stroke="var(--color-btc)" dot={false} strokeWidth={1.6} isAnimationActive={false} />
          <Line type="monotone" dataKey="eth" stroke="var(--color-eth)" dot={false} strokeWidth={1.6} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PathVolChart({ series }: { series: Snapshot["series"] }) {
  const data = rollingPathVol(series);
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid.stroke} />
          <XAxis dataKey="t" tickFormatter={fmtTime} tick={axis} minTickGap={48} />
          <YAxis tick={axis} tickFormatter={(v) => fmtUsd(v)} width={56} />
          <RTooltip content={<Tip labels={{ naked: "Naked $ rms", hedged: "Hedged $ rms" }} format={(n) => fmtUsd(n, 0)} />} />
          <Area type="monotone" dataKey="naked" stroke="var(--color-short)" fill="var(--color-short)" fillOpacity={0.12} isAnimationActive={false} />
          <Area type="monotone" dataKey="hedged" stroke="var(--color-long)" fill="var(--color-long)" fillOpacity={0.16} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FillRateChart({ cycles }: { cycles: Snapshot["cycles"] }) {
  const data = fillPath(cycles);
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid.stroke} />
          <XAxis dataKey="t" tickFormatter={fmtTime} tick={axis} minTickGap={48} />
          <YAxis domain={[0, 100]} tick={axis} tickFormatter={(v) => `${v}%`} width={40} />
          <RTooltip content={<Tip labels={{ fill: "Fill" }} format={(n) => `${fmtNum(n, 0)}%`} />} />
          <Line type="monotone" dataKey="fill" stroke="var(--color-accent)" dot={{ r: 2 }} strokeWidth={1.6} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CaptureChart({ cycles }: { cycles: Snapshot["cycles"] }) {
  const data = fillPath(cycles);
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid.stroke} />
          <XAxis dataKey="t" tickFormatter={fmtTime} tick={axis} minTickGap={48} />
          <YAxis tick={axis} tickFormatter={(v) => `${fmtNum(v, 1)}`} width={44} />
          <RTooltip
            content={<Tip labels={{ capture: "Capture", adverse: "Adverse" }} format={(n) => fmtBps(n)} />}
          />
          <Line type="monotone" dataKey="capture" stroke="var(--color-long)" dot={false} strokeWidth={1.6} isAnimationActive={false} />
          <Line type="monotone" dataKey="adverse" stroke="var(--color-warn)" dot={false} strokeWidth={1.4} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CumFillChart({ cycles }: { cycles: Snapshot["cycles"] }) {
  const data = fillPath(cycles);
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid.stroke} />
          <XAxis dataKey="t" tickFormatter={fmtTime} tick={axis} minTickGap={48} />
          <YAxis tick={axis} tickFormatter={(v) => fmtUsd(v)} width={64} />
          <RTooltip content={<Tip labels={{ cumUsd: "Filled", filledUsd: "Cycle" }} format={(n) => fmtUsd(n, 0)} />} />
          <Area type="monotone" dataKey="cumUsd" stroke="var(--color-btc)" fill="var(--color-btc)" fillOpacity={0.14} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CaptureHist({ cycles }: { cycles: Snapshot["cycles"] }) {
  const data = captureHist(cycles);
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid.stroke} />
          <XAxis dataKey="x" tick={axis} />
          <YAxis allowDecimals={false} tick={axis} width={32} />
          <RTooltip content={<Tip labels={{ n: "Fills" }} format={(n) => fmtNum(n, 0)} />} />
          <Bar dataKey="n" isAnimationActive={false} radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.lo >= 0 ? "var(--color-long)" : "var(--color-short)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ResidualVsFill({ cycles }: { cycles: Snapshot["cycles"] }) {
  const data = fillPath(cycles);
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid.stroke} />
          <XAxis dataKey="t" tickFormatter={fmtTime} tick={axis} minTickGap={48} />
          <YAxis yAxisId="l" tick={axis} tickFormatter={(v) => fmtNum(v, 3)} width={52} />
          <YAxis yAxisId="r" orientation="right" tick={axis} tickFormatter={(v) => `${v}%`} width={40} />
          <RTooltip
            content={
              <Tip
                labels={{ residual: "Residual Δ", fill: "Fill %" }}
                format={(n, name) => (name === "fill" ? `${fmtNum(n, 0)}%` : fmtNum(n, 4))}
              />
            }
          />
          <Line yAxisId="l" type="monotone" dataKey="residual" stroke="var(--color-eth)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <Line yAxisId="r" type="monotone" dataKey="fill" stroke="var(--color-muted)" dot={false} strokeWidth={1.2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
