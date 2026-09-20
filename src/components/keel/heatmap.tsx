import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { refreshRvSurface, selectRvCell, updateConfig } from "@/lib/hedge/actions";
import {
  HEDGE_FREQS,
  LOOKBACKS,
  cellKey,
  freqFromSec,
  formatInterval,
  minRvForLookback,
  type FreqId,
  type LookbackId,
  type RvSurface,
} from "@/lib/hedge/rv";
import type { Snapshot } from "@/lib/hedge/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function rvFill(rv: number, min: number, max: number) {
  const t = max <= min ? 0.5 : Math.min(1, Math.max(0, (rv - min) / (max - min)));
  // Match MCM chart: low RV = red, high RV = green.
  if (t < 0.5) {
    const u = t / 0.5;
    const r = lerp(153, 214, u);
    const g = lerp(27, 178, u);
    const b = lerp(27, 94, u);
    return `rgb(${r.toFixed(0)} ${g.toFixed(0)} ${b.toFixed(0)})`;
  }
  const u = (t - 0.5) / 0.5;
  const r = lerp(214, 22, u);
  const g = lerp(178, 128, u);
  const b = lerp(94, 72, u);
  return `rgb(${r.toFixed(0)} ${g.toFixed(0)} ${b.toFixed(0)})`;
}

function ink(rv: number, min: number, max: number) {
  const t = max <= min ? 0.5 : (rv - min) / (max - min);
  return t > 0.35 && t < 0.72 ? "#18181b" : "#f4f4f5";
}

export function RvHeatmap({ snap, setSnap }: { snap: Snapshot; setSnap: (s: Snapshot) => void }) {
  const [ccy, setCcy] = useState<"BTC" | "ETH">("BTC");
  const surface: RvSurface | undefined = snap.rv?.[ccy];
  const activeFreq = freqFromSec(snap.config.intervalSec);
  const activeLb = snap.config.targetLookback;
  const best = surface ? minRvForLookback(surface, activeLb) : null;

  const pick = useMutation({
    mutationFn: (cell: { freqId: FreqId; lookbackId: LookbackId }) => selectRvCell({ data: cell }),
    onSuccess: setSnap,
    onError: (e: Error) => toast.error(e.message),
  });
  const refresh = useMutation({
    mutationFn: () => refreshRvSurface(),
    onSuccess: setSnap,
  });
  const policy = useMutation({
    mutationFn: (patch: { freqPolicy: "manual" | "min_rv"; targetLookback?: LookbackId }) =>
      updateConfig({ data: patch }),
    onSuccess: setSnap,
  });

  const ready = Boolean(surface && surface.asOf);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-wrap gap-2">
        <div>
          <CardTitle>
            {ccy} — Composite RV across lookbacks and hedge frequencies
          </CardTitle>
          <p className="mt-1 text-xs text-muted">
            Close-to-close × Parkinson, annualized. Click a cell to hedge at that frequency. Red = lower RV.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md bg-surface-2 p-0.5">
            {(["BTC", "ETH"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCcy(c)}
                className={cn(
                  "h-8 min-w-11 rounded-sm px-2.5 text-xs font-medium",
                  ccy === c ? "bg-surface text-fg" : "text-muted",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            {refresh.isPending || !ready ? "Loading…" : "Refresh"}
          </Button>
        </div>
      </CardHeader>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Lookback</span>
          <div className="flex flex-wrap gap-1">
            {LOOKBACKS.map((lb) => (
              <button
                key={lb.id}
                type="button"
                onClick={() => policy.mutate({ freqPolicy: snap.config.freqPolicy, targetLookback: lb.id })}
                className={cn(
                  "h-8 rounded-md px-2 text-xs font-medium",
                  activeLb === lb.id ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
                )}
              >
                {lb.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs text-muted">Lock min-RV frequency</div>
            {best ? (
              <div className="font-mono text-xs text-fg">
                {activeLb} → {best.freqId} · {best.rv.toFixed(2)}%
              </div>
            ) : (
              <div className="text-xs text-subtle">waiting on Deribit bars</div>
            )}
          </div>
          <Switch
            checked={snap.config.freqPolicy === "min_rv"}
            onCheckedChange={(v) => policy.mutate({ freqPolicy: v ? "min_rv" : "manual" })}
          />
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto">
        <div className="flex min-w-[640px] gap-2 px-1">
          <div className="flex w-6 shrink-0 items-center justify-center">
            <span className="text-[10px] uppercase tracking-[0.16em] text-subtle" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              Hedging frequency
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="grid gap-px"
              style={{ gridTemplateColumns: `48px repeat(${LOOKBACKS.length}, minmax(64px, 1fr))` }}
            >
              <div />
              {LOOKBACKS.map((lb) => (
                <div
                  key={lb.id}
                  className={cn(
                    "pb-1 text-center text-[11px] uppercase tracking-[0.12em] text-subtle",
                    lb.id === activeLb && "text-fg",
                  )}
                >
                  {lb.label}
                </div>
              ))}
              {HEDGE_FREQS.map((freq) => (
                <FreqRow
                  key={freq.id}
                  freq={freq.id}
                  surface={surface}
                  activeFreq={activeFreq}
                  activeLb={activeLb}
                  bestFreq={best?.freqId ?? null}
                  onPick={(lookbackId) => pick.mutate({ freqId: freq.id, lookbackId })}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[11px] text-subtle">Lookback window</p>
              <LegendBar min={surface?.min ?? 31} max={surface?.max ?? 48} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function FreqRow({
  freq,
  surface,
  activeFreq,
  activeLb,
  bestFreq,
  onPick,
}: {
  freq: FreqId;
  surface: RvSurface | undefined;
  activeFreq: FreqId;
  activeLb: LookbackId;
  bestFreq: FreqId | null;
  onPick: (lb: LookbackId) => void;
}) {
  return (
    <>
      <div
        className={cn(
          "flex items-center pr-2 text-right text-[11px] uppercase tracking-[0.08em] text-subtle",
          freq === activeFreq && "font-medium text-fg",
        )}
      >
        {freq}
      </div>
      {LOOKBACKS.map((lb) => {
        const rv = surface?.cells[cellKey(freq, lb.id)] ?? null;
        const selected = freq === activeFreq && lb.id === activeLb;
        const champ = freq === bestFreq && lb.id === activeLb;
        return (
          <button
            key={lb.id}
            type="button"
            disabled={rv === null}
            onClick={() => onPick(lb.id)}
            className={cn(
              "flex h-11 items-center justify-center rounded-sm font-mono text-xs tabular-nums transition-[filter,box-shadow] duration-150",
              rv === null ? "bg-surface-2 text-subtle" : "hover:brightness-110",
              selected && "ring-2 ring-fg",
              champ && !selected && "ring-1 ring-accent",
            )}
            style={
              rv !== null && surface
                ? { background: rvFill(rv, surface.min, surface.max), color: ink(rv, surface.min, surface.max) }
                : undefined
            }
          >
            {rv === null ? "—" : rv.toFixed(2)}
          </button>
        );
      })}
    </>
  );
}

function LegendBar({ min, max }: { min: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-subtle">{min.toFixed(0)}</span>
      <div
        className="h-3 w-28 rounded-sm"
        style={{
          background: `linear-gradient(to right, ${rvFill(min, min, max)}, ${rvFill((min + max) / 2, min, max)}, ${rvFill(max, min, max)})`,
        }}
      />
      <span className="font-mono text-[10px] text-subtle">{max.toFixed(0)} Ann. RV %</span>
    </div>
  );
}

export function FreqChips({
  intervalSec,
  onPick,
}: {
  intervalSec: number;
  onPick: (sec: number) => void;
}) {
  const active = freqFromSec(intervalSec);
  return (
    <div className="flex flex-wrap gap-1">
      {HEDGE_FREQS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onPick(f.sec)}
          className={cn(
            "h-8 rounded-md px-2 text-xs font-medium",
            f.id === active ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

export function ActiveFreqBadge({ snap }: { snap: Snapshot }) {
  return (
    <Badge tone={snap.config.freqPolicy === "min_rv" ? "long" : "neutral"}>
      {formatInterval(snap.config.intervalSec)}
      {snap.config.freqPolicy === "min_rv" ? ` · ${snap.config.targetLookback}` : ""}
    </Badge>
  );
}
