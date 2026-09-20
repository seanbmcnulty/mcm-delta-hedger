import type { Snapshot } from "@/lib/hedge/types";
import { Badge } from "@/components/ui/badge";
import { fmtBps, fmtDelta, fmtNum, fmtTime, fmtUsd, signedClass } from "./format";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function PositionsTable({
  rows,
  hedgeFull,
  hedgeSkip,
  onToggle,
  onFull,
}: {
  rows: Snapshot["positions"];
  hedgeFull?: boolean;
  hedgeSkip?: string[];
  onToggle?: (instrument: string, include: boolean) => void;
  onFull?: (full: boolean) => void;
}) {
  if (!rows.length) return <Empty>No positions.</Empty>;
  const skip = new Set(hedgeSkip ?? []);
  const full = hedgeFull !== false;
  return (
    <div className="overflow-x-auto">
      {onFull ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onFull(!full)}
            className={cn(
              "h-9 rounded-md px-3 text-xs font-medium",
              full ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
            )}
          >
            Full positions hedging
          </button>
          <span className="text-xs text-muted">Uncheck a leg to keep its native delta.</span>
        </div>
      ) : null}
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-[0.12em] text-subtle">
          <tr>
            {onToggle ? <th className="pb-2 font-medium">Hedge</th> : null}
            <th className="pb-2 font-medium">Instrument</th>
            <th className="pb-2 font-medium">Kind</th>
            <th className="pb-2 font-medium text-right">Size</th>
            <th className="pb-2 font-medium text-right">Δ</th>
            <th className="pb-2 font-medium text-right">Γ</th>
            <th className="pb-2 font-medium text-right">Vega</th>
            <th className="pb-2 font-medium text-right">Mark</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {rows.map((p) => {
            const on = full || !skip.has(p.instrument);
            return (
              <tr key={p.instrument} className="border-t border-border">
                {onToggle ? (
                  <td className="py-2">
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`Hedge ${p.instrument}`}
                      onClick={() => onToggle(p.instrument, !on)}
                      className={cn(
                        "inline-flex size-9 items-center justify-center rounded-md",
                        on ? "bg-long/15 text-long" : "bg-surface-2 text-subtle",
                      )}
                    >
                      {on ? <Check className="size-4" /> : null}
                    </button>
                  </td>
                ) : null}
                <td className="py-2.5 text-fg">{p.instrument}</td>
                <td className="py-2.5 text-muted">{p.kind}</td>
                <td className={cn("py-2.5 text-right", signedClass(p.size))}>
                  {fmtNum(p.size, p.kind === "option" ? 1 : 0)}
                </td>
                <td className={cn("py-2.5 text-right", signedClass(p.delta))}>{fmtDelta(p.delta)}</td>
                <td className="py-2.5 text-right text-muted">{fmtNum(p.gamma, 5)}</td>
                <td className="py-2.5 text-right text-muted">{fmtNum(p.vega, 2)}</td>
                <td className="py-2.5 text-right">{fmtNum(p.mark, 2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function OrdersTable({ rows }: { rows: Snapshot["orders"] }) {
  const open = rows.filter((o) => o.state === "open");
  if (!open.length) return <Empty>No resting maker orders.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-[0.12em] text-subtle">
          <tr>
            <th className="pb-2 font-medium">Label</th>
            <th className="pb-2 font-medium">Side</th>
            <th className="pb-2 font-medium text-right">Price</th>
            <th className="pb-2 font-medium text-right">Amount</th>
            <th className="pb-2 font-medium text-right">Filled</th>
            <th className="pb-2 font-medium">State</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {open.map((o) => (
            <tr key={o.id} className="border-t border-border">
              <td className="py-2.5">{o.label}</td>
              <td className={cn("py-2.5 uppercase", o.side === "buy" ? "text-long" : "text-short")}>{o.side}</td>
              <td className="py-2.5 text-right">{fmtNum(o.price, 2)}</td>
              <td className="py-2.5 text-right">{fmtUsd(o.amountUsd)}</td>
              <td className="py-2.5 text-right">{fmtUsd(o.filledUsd)}</td>
              <td className="py-2.5">
                <Badge tone="muted">{o.state}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CyclesTable({ rows }: { rows: Snapshot["cycles"] }) {
  if (!rows.length) return <Empty>No hedge clocks yet. Save and Run to flatten on the interval.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-[0.12em] text-subtle">
          <tr>
            <th className="pb-2 font-medium">#</th>
            <th className="pb-2 font-medium">Time</th>
            <th className="pb-2 font-medium">Ccy</th>
            <th className="pb-2 font-medium text-right">Start Δ</th>
            <th className="pb-2 font-medium text-right">End Δ</th>
            <th className="pb-2 font-medium text-right">Filled</th>
            <th className="pb-2 font-medium text-right">Fill</th>
            <th className="pb-2 font-medium text-right">Capture</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {rows.slice(0, 40).map((c) => (
            <tr key={`${c.currency}-${c.id}`} className="border-t border-border">
              <td className="py-2.5 text-muted">{c.id}</td>
              <td className="py-2.5">{fmtTime(c.startedAt)}</td>
              <td className="py-2.5">{c.currency}</td>
              <td className={cn("py-2.5 text-right", signedClass(c.startDelta))}>{fmtDelta(c.startDelta)}</td>
              <td className={cn("py-2.5 text-right", signedClass(c.endDelta ?? 0))}>
                {c.endDelta === null ? "…" : fmtDelta(c.endDelta)}
              </td>
              <td className="py-2.5 text-right">{fmtUsd(c.filledUsd)}</td>
              <td className="py-2.5 text-right">{(c.fillRate * 100).toFixed(0)}%</td>
              <td className="py-2.5 text-right">{c.captureBps === null ? "—" : fmtBps(c.captureBps)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TapeList({ rows }: { rows: Snapshot["tape"] }) {
  if (!rows.length) return <Empty>Silent.</Empty>;
  return (
    <ol className="space-y-2 font-mono text-xs">
      {rows.map((e, i) => (
        <li key={`${e.t}-${i}`} className="flex gap-3">
          <span className="shrink-0 text-subtle tabular-nums">{fmtTime(e.t)}</span>
          <span
            className={cn(
              "min-w-10 uppercase tracking-wide",
              e.level === "fill" && "text-long",
              e.level === "warn" && "text-warn",
              e.level === "error" && "text-short",
              e.level === "policy" && "text-eth",
              e.level === "info" && "text-muted",
            )}
          >
            {e.level}
          </span>
          <span className="text-fg">{e.message}</span>
        </li>
      ))}
    </ol>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="py-10 text-center text-sm text-muted">{children}</p>;
}
