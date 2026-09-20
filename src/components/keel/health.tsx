import { useMutation } from "@tanstack/react-query";
import { Bell, BellOff, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ackAlerts, testAlert, tripFailsafe } from "@/lib/hedge/actions";
import type { Snapshot } from "@/lib/hedge/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtTime } from "./format";

export function HealthStrip({ snap }: { snap: Snapshot }) {
  const h = snap.health;
  if (!h) return null;
  const loopAge = h.lastServerAt ? Math.max(0, Math.round((snap.now - h.lastServerAt) / 1000)) : null;
  const dashAge = h.lastClientAt ? Math.max(0, Math.round((snap.now - h.lastClientAt) / 1000)) : null;
  const tone = h.status === "ok" ? "long" : h.status === "degraded" ? "warn" : "short";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={tone}>{h.status}</Badge>
      <Badge tone={h.circuit === "closed" ? "muted" : "short"}>circuit {h.circuit.replace("_", " ")}</Badge>
      <Badge tone={h.serverLoop ? "long" : "warn"}>loop {h.serverLoop ? (loopAge == null ? "on" : `${loopAge}s`) : "down"}</Badge>
      <Badge tone={h.dashboardStale ? "warn" : "muted"}>dash {dashAge == null ? "—" : `${dashAge}s`}</Badge>
      <Badge tone={h.stayAlive ? (snap.stayAlivePersisted ? "long" : "warn") : "muted"}>
        {h.stayAlive
          ? snap.stayAlivePersisted
            ? h.lastWakeAt
              ? `bg ${Math.max(0, Math.round((snap.now - h.lastWakeAt) / 1000))}s`
              : "background"
            : "bg · not stored"
          : "attended"}
      </Badge>
      <Badge tone="muted">idx {h.indexSource}</Badge>
      {h.consecutiveFailures > 0 ? <Badge tone="warn">fails {h.consecutiveFailures}</Badge> : null}
      {h.unackedCritical > 0 ? <Badge tone="short">{h.unackedCritical} critical</Badge> : null}
    </div>
  );
}

export function AlertBanner({ snap, setSnap }: { snap: Snapshot; setSnap: (s: Snapshot) => void }) {
  const open = snap.alerts.filter((a) => !a.acked && a.severity !== "info");
  const ack = useMutation({
    mutationFn: () => ackAlerts({ data: {} }),
    onSuccess: setSnap,
  });
  if (!open.length && !snap.lastError) return null;
  const top = open[0] ?? null;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between",
        top?.severity === "critical" || snap.health.status === "critical" ? "bg-short/10 text-short" : "bg-warn/10 text-warn",
      )}
    >
      <p className="min-w-0">
        {top ? (
          <>
            <span className="font-medium">{top.title}</span>
            <span className="text-current/80"> — {top.detail}</span>
          </>
        ) : (
          snap.lastError
        )}
        {snap.health.dashboardStale ? (
          <span className="mt-1 block text-xs text-warn">Dashboard idle — server loop is still hedging.</span>
        ) : null}
      </p>
      {open.length ? (
        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => ack.mutate()}>
          Ack {open.length}
        </Button>
      ) : null}
    </div>
  );
}

export function AlertsPanel({ snap, setSnap }: { snap: Snapshot; setSnap: (s: Snapshot) => void }) {
  const test = useMutation({
    mutationFn: () => testAlert(),
    onSuccess: (s) => {
      setSnap(s);
      toast.message("Test alert fired.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const trip = useMutation({
    mutationFn: () => tripFailsafe(),
    onSuccess: (s) => {
      setSnap(s);
      toast.error("Fail-safe tripped. Orders cancelled.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ack = useMutation({
    mutationFn: () => ackAlerts({ data: {} }),
    onSuccess: setSnap,
  });
  const perm = typeof Notification !== "undefined" ? Notification.permission : "denied";

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Dual tick sources (server loop + this tab), two-pass kill, circuit after 5 failed ticks, watchdog at 20s.
        Keys never leave server memory. Webhook is HTTPS-only.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            if (typeof Notification === "undefined") {
              toast.error("Desktop alerts are not available in this browser.");
              return;
            }
            const p = await Notification.requestPermission();
            toast.message(p === "granted" ? "Desktop alerts on." : "Desktop alerts blocked.");
          }}
        >
          {perm === "granted" ? <Bell /> : <BellOff />}
          Desktop alerts
        </Button>
        <Button variant="secondary" size="sm" onClick={() => test.mutate()} disabled={test.isPending}>
          Test alert
        </Button>
        <Button variant="danger" size="sm" onClick={() => trip.mutate()} disabled={trip.isPending}>
          <ShieldAlert />
          Trip fail-safe
        </Button>
        <Button variant="ghost" size="sm" onClick={() => ack.mutate()}>
          Ack all
        </Button>
      </div>
      {snap.health.cooldownMs > 0 ? (
        <p className="text-xs text-warn">Circuit cooling {Math.ceil(snap.health.cooldownMs / 1000)}s before re-arm.</p>
      ) : null}
      {snap.alerts.length ? (
        <ol className="space-y-2 font-mono text-xs">
          {snap.alerts.map((a) => (
            <li key={a.id} className="flex gap-3">
              <span className="shrink-0 text-subtle tabular-nums">{fmtTime(a.t)}</span>
              <span
                className={cn(
                  "min-w-16 uppercase tracking-wide",
                  a.severity === "critical" && "text-short",
                  a.severity === "warn" && "text-warn",
                  a.severity === "info" && "text-muted",
                )}
              >
                {a.severity}
              </span>
              <span className={cn("text-fg", a.acked && "text-muted")}>
                {a.title} — {a.detail}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-8 text-center text-sm text-muted">No alerts yet. Test alert exercises the notify path.</p>
      )}
    </div>
  );
}
