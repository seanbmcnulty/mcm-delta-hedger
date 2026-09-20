import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  armEngine,
  connectVenue,
  disconnectVenue,
  disarmEngine,
  getSnapshot,
  killEngine,
  resetConfig,
  runCoach,
  setVenue,
  setWebhook,
  tickEngine,
  updateConfig,
} from "@/lib/hedge/actions";
import { ddhCurrent, ddhThresholds, deviationDelta, includedPositions, sumGreeks } from "@/lib/hedge/math";
import { CHECK_INTERVALS, LOOKBACKS, formatInterval } from "@/lib/hedge/rv";
import type { Currency, HedgeConfig, Snapshot, Venue } from "@/lib/hedge/types";
import { PERP } from "@/lib/hedge/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Tooltip } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { BookLadder, DdhDeltaChart, IntervalBars, ScoreRing } from "./charts";
import {
  CaptureChart,
  CaptureHist,
  CumFillChart,
  FillRateChart,
  HedgeRvStrip,
  PathVolChart,
  ResidualVsFill,
  SessionRvChart,
} from "./fill-charts";
import { AlertBanner, AlertsPanel, HealthStrip } from "./health";
import { useAlertNotify } from "./notify";
import { CyclesTable, OrdersTable, PositionsTable, TapeList } from "./tables";
import { fmtDelta, fmtNum, fmtUsd, signedClass } from "./format";
import { ActiveFreqBadge, RvHeatmap } from "./heatmap";
import { KeyRound, ShieldAlert, Square } from "lucide-react";

const QK = ["keel"] as const;

function ClientOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  if (!on) return <>{fallback ?? null}</>;
  return <>{children}</>;
}

function useKeel(initial?: Snapshot) {
  const qc = useQueryClient();
  const user = useCurrentUser();
  const query = useQuery({
    queryKey: [...QK, user?.id ?? "anon"],
    queryFn: () => getSnapshot(),
    refetchInterval: 4000,
    initialData: initial,
    enabled: Boolean(user?.id),
  });
  const setSnap = (s: Snapshot) => qc.setQueryData([...QK, user?.id ?? "anon"], s);

  useEffect(() => {
    if (!user?.id) return;
    tickEngine()
      .then(setSnap)
      .catch(() => {});
    const venue = query.data?.venue;
    const ms = venue === "paper" ? 2000 : 4000;
    const id = window.setInterval(() => {
      tickEngine()
        .then(setSnap)
        .catch(() => {});
    }, ms);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data?.venue, qc, user?.id]);

  return { snap: query.data, query, setSnap, qc };
}

export function KeelApp({ initial }: { initial?: Snapshot }) {
  const { snap, query, setSnap } = useKeel(initial);
  const [tab, setTab] = useState("positions");
  const [ccy, setCcy] = useState<Currency>("BTC");
  useAlertNotify(snap?.alerts ?? []);

  if (query.isLoading && !snap) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-muted">
        <p className="font-mono text-sm tracking-wide">Loading book…</p>
      </div>
    );
  }
  if (query.isError && !snap) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg px-6 text-center">
        <p className="text-sm text-short">Could not start the engine. Reload.</p>
      </div>
    );
  }
  if (!snap) return null;

  return (
    <div className="keel-grid min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-4 pb-24 md:px-6 md:pb-8">
        <Header snap={snap} setSnap={setSnap} />
        <HealthStrip snap={snap} />
        <AlertBanner snap={snap} setSnap={setSnap} />
        <CurrencyBar ccy={ccy} onCcy={setCcy} snap={snap} />
        <DdhStrip snap={snap} ccy={ccy} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Delta Total · {ccy}</CardTitle>
              <span className="font-mono text-xs text-muted">{PERP[ccy]}</span>
            </CardHeader>
            <ClientOnly fallback={<div className="h-64" />}>
              <DdhDeltaChart
                series={snap.series}
                ccy={ccy}
                target={
                  snap.config.deltaUnit === "usd"
                    ? (snap.config.targetDelta[ccy] ?? 0) / Math.max(1, snap.indices[ccy])
                    : (snap.config.targetDelta[ccy] ?? 0)
                }
                thresholdPos={
                  ddhThresholds(snap.config, ccy).pos /
                  (snap.config.deltaUnit === "usd" ? Math.max(1, snap.indices[ccy]) : 1)
                }
                thresholdNeg={
                  ddhThresholds(snap.config, ccy).neg /
                  (snap.config.deltaUnit === "usd" ? Math.max(1, snap.indices[ccy]) : 1)
                }
                hedges={snap.cycles.filter((c) => c.currency === ccy).map((c) => c.startedAt)}
              />
            </ClientOnly>
            <p className="mt-2 text-xs text-muted">
              Left: Δ Total. Right: {ccy}-PERP mark. Shade is the idle band. Vertical ticks are clocks.
            </p>
          </Card>
          <ClientOnly
            fallback={
              <Card>
                <CardHeader>
                  <CardTitle>Parameters</CardTitle>
                </CardHeader>
                <div className="h-[420px]" />
              </Card>
            }
          >
            <DdhPanel snap={snap} setSnap={setSnap} ccy={ccy} />
          </ClientOnly>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Card className="min-w-0">
            <Tabs value={tab} onValueChange={setTab}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <TabsList className="flex-wrap">
                  <TabsTrigger value="positions">Positions</TabsTrigger>
                  <TabsTrigger value="orders">Orders</TabsTrigger>
                  <TabsTrigger value="cycles">Hedges</TabsTrigger>
                  <TabsTrigger value="tape">Log</TabsTrigger>
                  <TabsTrigger value="fills">Fills</TabsTrigger>
                  <TabsTrigger value="rv">RV</TabsTrigger>
                  <TabsTrigger value="alerts">Alerts</TabsTrigger>
                  <TabsTrigger value="eval">Eval</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="positions">
                <PositionsTable
                  rows={snap.positions.filter((p) => p.currency === ccy)}
                  hedgeFull={snap.config.hedgeFull}
                  hedgeSkip={snap.config.hedgeSkip}
                  onToggle={(instrument, include) => {
                    const skip = new Set(snap.config.hedgeSkip ?? []);
                    if (include) skip.delete(instrument);
                    else skip.add(instrument);
                    void updateConfig({
                      data: { hedgeFull: false, hedgeSkip: [...skip] },
                    }).then(setSnap);
                  }}
                  onFull={(full) => {
                    void updateConfig({
                      data: { hedgeFull: full, hedgeSkip: full ? [] : snap.config.hedgeSkip },
                    }).then(setSnap);
                  }}
                />
              </TabsContent>
              <TabsContent value="orders">
                <OrdersTable rows={snap.orders.filter((o) => o.currency === ccy)} />
              </TabsContent>
              <TabsContent value="cycles">
                <CyclesTable rows={snap.cycles.filter((c) => c.currency === ccy)} />
              </TabsContent>
              <TabsContent value="tape">
                <TapeList rows={snap.tape} />
              </TabsContent>
              <TabsContent value="fills">
                <FillsTab snap={snap} />
              </TabsContent>
              <TabsContent value="rv">
                <RvHeatmap snap={snap} setSnap={setSnap} />
              </TabsContent>
              <TabsContent value="alerts">
                <AlertsPanel snap={snap} setSnap={setSnap} />
              </TabsContent>
              <TabsContent value="eval">
                <EvalPanel snap={snap} setSnap={setSnap} />
              </TabsContent>
            </Tabs>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Perp book</CardTitle>
            </CardHeader>
            <BookLadder book={snap.books[PERP[ccy]]} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function CurrencyBar({
  ccy,
  onCcy,
  snap,
}: {
  ccy: Currency;
  onCcy: (c: Currency) => void;
  snap: Snapshot;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex rounded-lg bg-surface-2 p-1">
        {(["BTC", "ETH"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onCcy(c)}
            className={cn(
              "h-11 min-w-16 rounded-md px-4 text-sm font-medium",
              ccy === c ? "bg-surface text-fg" : "text-muted",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="font-mono text-xs text-muted">
        {formatInterval(snap.config.intervalSec)} · {snap.config.hedgePct}% ·{" "}
        {snap.config.deltaUnit === "usd" ? "USD" : "coin"}
      </div>
    </div>
  );
}

function DdhStrip({ snap, ccy }: { snap: Snapshot; ccy: Currency }) {
  const included = includedPositions(snap.positions, snap.config.hedgeFull !== false, snap.config.hedgeSkip ?? []);
  const g = sumGreeks(included, ccy);
  const unit = snap.config.deltaUnit;
  const index = snap.indices[ccy] || 1;
  const target = snap.config.targetDelta[ccy] ?? 0;
  const deltaCoin =
    snap.venue !== "paper" && snap.config.hedgeFull !== false
      ? (snap.account[ccy]?.deltaTotal ?? g.delta)
      : g.delta;
  const current = ddhCurrent(deltaCoin, index, unit);
  const thr = ddhThresholds(snap.config, ccy);
  const dev = deviationDelta(current, target);
  const outside = Boolean(dev.raw >= thr.pos && dev.raw > 0) || Boolean(-dev.raw >= thr.neg && dev.raw < 0);
  const remain = snap.armed && snap.nextCycleAt ? Math.max(0, snap.nextCycleAt - snap.now) : 0;
  const fmtU = (n: number) => (unit === "usd" ? fmtUsd(n, 0) : fmtDelta(n));
  const items = [
    { k: "Δ Total", v: fmtDelta(deltaCoin), n: deltaCoin, sub: unit === "usd" ? fmtUsd(current, 0) : `opt ${fmtDelta(g.optionDelta)}` },
    { k: "Δ Target", v: fmtU(target), n: target, sub: unit === "usd" ? "USD-based" : "each clock" },
    { k: "Residual", v: fmtU(dev.raw), n: dev.raw, sub: `± ${fmtU(Math.max(thr.pos, thr.neg))}` },
    { k: "Band", v: outside ? "outside" : "inside", n: 0, sub: outside ? "hedge on clock" : "clock will skip" },
    {
      k: "Clock",
      v: formatInterval(snap.config.intervalSec),
      n: 0,
      sub: snap.config.freqPolicy === "min_rv" ? `min RV ${snap.config.targetLookback}` : "manual",
    },
    {
      k: "Next",
      v: snap.armed ? `${Math.ceil(remain / 1000)}s` : "off",
      n: 0,
      sub: snap.armed ? "running" : "stopped",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <div key={it.k} className="rounded-xl bg-surface px-3 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
          <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">{it.k}</div>
          <div className={cn("mt-1 font-mono text-xl tabular-nums", it.k === "Residual" || it.k === "Δ Total" ? signedClass(it.n) : "", it.k === "Band" && outside ? "text-warn" : "")}>
            {it.v}
          </div>
          <div className="font-mono text-[11px] text-muted">{it.sub}</div>
        </div>
      ))}
    </div>
  );
}

function Header({ snap, setSnap }: { snap: Snapshot; setSnap: (s: Snapshot) => void }) {
  const kill = useMutation({
    mutationFn: () => killEngine(),
    onSuccess: (s) => {
      setSnap(s);
      toast.message("All hedger orders cancelled.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className={cn("mt-1 h-10 w-1 shrink-0 rounded-full", snap.armed ? "bg-long" : "bg-border")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-medium tracking-tight">MCM Delta Hedger</h1>
            <Badge tone={snap.venue === "mainnet" ? "short" : snap.venue === "testnet" ? "warn" : "muted"}>
              {snap.venue}
            </Badge>
            <Badge tone={snap.armed ? "long" : "muted"}>
              {snap.armed
                ? snap.config.stayAlive && snap.stayAlivePersisted
                  ? "Background"
                  : "Running"
                : "Stopped"}
            </Badge>
            <ActiveFreqBadge snap={snap} />
            {snap.connected && snap.clientIdMasked ? <Badge tone="neutral">{snap.clientIdMasked}</Badge> : null}
            <span className="md:ml-auto">
              <UserButton />
            </span>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Maker-only. Clock first (1m, 1h, …), then hedge only if residual is outside tolerance.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-end">
        <ConnectDialog snap={snap} setSnap={setSnap} />
        <Button variant="danger" onClick={() => kill.mutate()} className="min-h-11 w-full md:w-auto">
          <Square />
          Kill
        </Button>
      </div>
    </header>
  );
}

function ConnectDialog({ snap, setSnap }: { snap: Snapshot; setSnap: (s: Snapshot) => void }) {
  const [open, setOpen] = useState(false);
  const [venue, setVenueLocal] = useState<Venue>(snap.venue);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [confirmLive, setConfirmLive] = useState("");
  const [webhook, setWebhookLocal] = useState("");

  const venueMut = useMutation({
    mutationFn: (v: Venue) => setVenue({ data: { venue: v } }),
    onSuccess: setSnap,
  });
  const connectMut = useMutation({
    mutationFn: () =>
      connectVenue({
        data: { venue, clientId, clientSecret, webhookUrl: webhook.trim() || undefined },
      }),
    onSuccess: (s) => {
      setSnap(s);
      setClientSecret("");
      setOpen(false);
      toast.message(venue === "paper" ? "Paper venue ready." : `Connected ${venue}.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const disc = useMutation({
    mutationFn: () => disconnectVenue(),
    onSuccess: (s) => {
      setSnap(s);
      toast.message("Dropped live keys. Back on paper.");
    },
  });
  const hookMut = useMutation({
    mutationFn: () => setWebhook({ data: { url: webhook.trim() || null } }),
    onSuccess: (s) => {
      setSnap(s);
      toast.message(s.webhookMasked ? `Webhook ${s.webhookMasked}` : "Webhook cleared.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const liveBlocked = venue === "mainnet" && confirmLive !== "LIVE";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11 w-full md:w-auto">
          <KeyRound />
          Keys
        </Button>
      </DialogTrigger>
      <DialogContent title="Venue & keys">
        <p className="mb-4 text-sm text-muted">
          Keys stay in server memory. Deribit account:read + trade:read_write. Live pulls portfolio delta from the
          venue. Type LIVE for mainnet.
        </p>
        <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1">
          {(["paper", "testnet", "mainnet"] as Venue[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setVenueLocal(v);
                if (v === "paper") venueMut.mutate(v);
              }}
              className={cn(
                "h-9 rounded-md text-xs font-medium capitalize",
                venue === v ? "bg-surface text-fg" : "text-muted",
              )}
            >
              {v}
            </button>
          ))}
        </div>
        {venue !== "paper" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cid">Client ID</Label>
              <Input
                id="cid"
                autoComplete="off"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="csec">Client secret</Label>
              <Input
                id="csec"
                type="password"
                autoComplete="off"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>
            {venue === "mainnet" ? (
              <div className="space-y-1.5">
                <Label htmlFor="live">Type LIVE to enable mainnet</Label>
                <Input id="live" value={confirmLive} onChange={(e) => setConfirmLive(e.target.value)} placeholder="LIVE" />
                <p className="flex items-start gap-2 text-xs text-warn">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                  Real orders. Start on testnet.
                </p>
              </div>
            ) : null}
            <Button
              className="w-full"
              disabled={connectMut.isPending || liveBlocked || !clientId || !clientSecret}
              onClick={() => connectMut.mutate()}
            >
              {connectMut.isPending ? "Connecting…" : "Connect"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Paper short-gamma book vs live Deribit index. Save and Run to hedge with simulated maker perps.
          </p>
        )}
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="hook">Alert webhook (optional)</Label>
          <Input
            id="hook"
            type="url"
            autoComplete="off"
            placeholder="https://…"
            value={webhook}
            onChange={(e) => setWebhookLocal(e.target.value)}
          />
          <Button variant="secondary" className="w-full" onClick={() => hookMut.mutate()} disabled={hookMut.isPending}>
            {hookMut.isPending ? "Saving…" : "Save webhook"}
          </Button>
        </div>
        {snap.venue !== "paper" ? (
          <Button variant="ghost" className="mt-3 w-full" onClick={() => disc.mutate()}>
            Drop keys
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function draftKey(c: HedgeConfig, wantOn: boolean) {
  return JSON.stringify({
    intervalSec: c.intervalSec,
    threshold: c.threshold,
    thresholdPos: c.thresholdPos,
    thresholdNeg: c.thresholdNeg,
    targetDelta: c.targetDelta,
    hedgePct: c.hedgePct,
    quoteOffsetTicks: c.quoteOffsetTicks,
    rejectPostOnly: c.rejectPostOnly,
    currencies: c.currencies,
    edition: c.edition,
    deltaUnit: c.deltaUnit,
    longInstrument: c.longInstrument,
    shortInstrument: c.shortInstrument,
    orderAmountCoin: c.orderAmountCoin,
    freqPolicy: c.freqPolicy,
    targetLookback: c.targetLookback,
    stayAlive: c.stayAlive,
    wantOn,
  });
}

function hedgeChoices(snap: Snapshot, ccy: Currency) {
  const set = new Set<string>([
    PERP[ccy],
    snap.config.longInstrument?.[ccy] || PERP[ccy],
    snap.config.shortInstrument?.[ccy] || PERP[ccy],
  ]);
  for (const k of Object.keys(snap.books)) {
    if (k.startsWith(`${ccy}-`)) set.add(k);
  }
  for (const p of snap.positions) {
    if (p.currency === ccy && p.kind === "future") set.add(p.instrument);
  }
  return [...set];
}

function DdhPanel({
  snap,
  setSnap,
  ccy,
}: {
  snap: Snapshot;
  setSnap: (s: Snapshot) => void;
  ccy: Currency;
}) {
  const [draft, setDraft] = useState<HedgeConfig>(snap.config);
  const [wantOn, setWantOn] = useState(snap.armed);
  const [armConfirm, setArmConfirm] = useState("");
  const [dirty, setDirty] = useState(false);
  const [tgtStr, setTgtStr] = useState(String(snap.config.targetDelta[ccy] ?? 0));

  useEffect(() => {
    if (!dirty) {
      setDraft(snap.config);
      setWantOn(snap.armed);
    }
    setTgtStr(String((dirty ? draft : snap.config).targetDelta[ccy] ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.config, snap.armed, dirty, ccy]);

  const paramsPending = draftKey(snap.config, snap.armed) !== draftKey(draft, snap.armed);
  const needArmWord = snap.venue === "mainnet" && !snap.armed;

  const payload = () => ({
    intervalSec: draft.intervalSec,
    threshold: draft.threshold,
    thresholdPos: draft.thresholdPos,
    thresholdNeg: draft.thresholdNeg,
    targetDelta: draft.targetDelta,
    hedgePct: draft.hedgePct,
    quoteOffsetTicks: draft.quoteOffsetTicks,
    rejectPostOnly: draft.rejectPostOnly,
    currencies: draft.currencies,
    freqPolicy: draft.freqPolicy,
    targetLookback: draft.targetLookback,
    edition: "pro" as const,
    deltaUnit: draft.deltaUnit,
    longInstrument: draft.longInstrument,
    shortInstrument: draft.shortInstrument,
    orderAmountCoin: draft.orderAmountCoin,
    stayAlive: draft.stayAlive,
  });

  const save = useMutation({
    mutationFn: async () => updateConfig({ data: payload() }),
    onSuccess: (s) => {
      setSnap(s);
      setDirty(false);
      toast.message("Parameters saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const run = useMutation({
    mutationFn: async () => {
      const s1 = await updateConfig({ data: payload() });
      if (!s1.armed) {
        return armEngine({ data: { confirm: snap.venue === "mainnet" ? armConfirm : undefined } });
      }
      return s1;
    },
    onSuccess: (s) => {
      setSnap(s);
      setDirty(false);
      setWantOn(true);
      setArmConfirm("");
      toast.message("MCM Delta Hedger running.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const stop = useMutation({
    mutationFn: () => disarmEngine(),
    onSuccess: (s) => {
      setSnap(s);
      setWantOn(false);
      toast.message("Hedger stopped. Parameters kept.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: () => resetConfig(),
    onSuccess: (s) => {
      setSnap(s);
      setDirty(false);
    },
  });

  const patch = (p: Partial<HedgeConfig>) => {
    setDraft((d) => {
      const next = {
        ...d,
        ...p,
        edition: "pro" as const,
        threshold: { ...d.threshold, ...(p.threshold ?? {}) },
        thresholdPos: { ...d.thresholdPos, ...(p.thresholdPos ?? {}) },
        thresholdNeg: { ...d.thresholdNeg, ...(p.thresholdNeg ?? {}) },
        targetDelta: { ...d.targetDelta, ...(p.targetDelta ?? {}) },
        longInstrument: { ...d.longInstrument, ...(p.longInstrument ?? {}) },
        shortInstrument: { ...d.shortInstrument, ...(p.shortInstrument ?? {}) },
        orderAmountCoin: { ...d.orderAmountCoin, ...(p.orderAmountCoin ?? {}) },
      };
      return next;
    });
    setDirty(true);
  };

  const target = draft.targetDelta[ccy] ?? 0;
  const thr = draft.threshold[ccy];
  const pos = draft.thresholdPos?.[ccy] ?? thr;
  const neg = draft.thresholdNeg?.[ccy] ?? thr;
  const unit = draft.deltaUnit === "usd" ? "USD" : ccy;
  const choices = hedgeChoices(snap, ccy);
  const busy = save.isPending || run.isPending || stop.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parameters</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => reset.mutate()}>
          Defaults
        </Button>
      </CardHeader>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
            {(["coin", "usd"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  if (u === draft.deltaUnit) return;
                  const idx = snap.indices[ccy] || 1;
                  const scale = u === "usd" ? idx : 1 / idx;
                  patch({
                    deltaUnit: u,
                    targetDelta: { ...draft.targetDelta, [ccy]: (draft.targetDelta[ccy] ?? 0) * scale },
                    threshold: { ...draft.threshold, [ccy]: draft.threshold[ccy] * scale },
                    thresholdPos: {
                      ...draft.thresholdPos,
                      [ccy]: (draft.thresholdPos[ccy] ?? draft.threshold[ccy]) * scale,
                    },
                    thresholdNeg: {
                      ...draft.thresholdNeg,
                      [ccy]: (draft.thresholdNeg[ccy] ?? draft.threshold[ccy]) * scale,
                    },
                  });
                }}
                className={cn(
                  "h-10 rounded-md text-sm font-medium uppercase",
                  draft.deltaUnit === u ? "bg-surface text-fg" : "text-muted",
                )}
              >
                {u}
              </button>
            ))}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Hedge every</span>
            <span className="font-mono tabular-nums text-muted">{formatInterval(draft.intervalSec)}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {CHECK_INTERVALS.slice(0, 7).map((it) => (
              <Button
                key={it.sec}
                size="sm"
                variant={draft.intervalSec === it.sec ? "default" : "secondary"}
                onClick={() => patch({ intervalSec: it.sec, freqPolicy: "manual" })}
              >
                {it.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <div>
              <div className="text-sm">Lock min RV</div>
              <div className="text-xs text-muted">Clock = lowest-RV cell on the heatmap.</div>
            </div>
            <Switch
              checked={draft.freqPolicy === "min_rv"}
              onCheckedChange={(v) => patch({ freqPolicy: v ? "min_rv" : "manual" })}
            />
          </div>
          {draft.freqPolicy === "min_rv" ? (
            <div className="space-y-1.5">
              <Label>Lookback</Label>
              <Select
                value={draft.targetLookback}
                onValueChange={(v) => patch({ targetLookback: v as typeof draft.targetLookback })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOOKBACKS.map((lb) => (
                    <SelectItem key={lb.id} value={lb.id}>
                      {lb.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tgt">Delta Target ({unit})</Label>
          <Input
            id="tgt"
            inputMode="decimal"
            value={tgtStr}
            onChange={(e) => setTgtStr(e.target.value)}
            onBlur={() => {
              const n = Number(tgtStr);
              if (Number.isFinite(n)) patch({ targetDelta: { ...draft.targetDelta, [ccy]: n } });
              else setTgtStr(String(target));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          <p className="text-[11px] text-muted">Each clock hedges toward this if outside the band. 0 = flat.</p>
        </div>
        <SliderRow
          label={`+ Tolerance (${unit})`}
          value={fmtNum(pos, 3)}
          min={ccy === "BTC" ? 0.01 : 0.1}
          max={ccy === "BTC" ? (unit === "USD" ? 200000 : 5) : 50}
          step={ccy === "BTC" ? 0.01 : 0.1}
          current={pos}
          onCommit={(v) => patch({ thresholdPos: { ...draft.thresholdPos, [ccy]: v } })}
          hint="After the clock: short the hedge contract only if residual ≥ this."
        />
        <SliderRow
          label={`− Tolerance (${unit})`}
          value={fmtNum(neg, 3)}
          min={ccy === "BTC" ? 0.01 : 0.1}
          max={ccy === "BTC" ? (unit === "USD" ? 200000 : 5) : 50}
          step={ccy === "BTC" ? 0.01 : 0.1}
          current={neg}
          onCommit={(v) => patch({ thresholdNeg: { ...draft.thresholdNeg, [ccy]: v } })}
          hint="After the clock: long the hedge contract only if residual ≤ −this."
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Hedging Ratio</span>
            <span className="font-mono tabular-nums text-muted">{draft.hedgePct}%</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {[30, 50, 100, 150].map((p) => (
              <Button
                key={p}
                size="sm"
                variant={draft.hedgePct === p ? "default" : "secondary"}
                onClick={() => patch({ hedgePct: p })}
              >
                {p}%
              </Button>
            ))}
          </div>
          <SliderRow
            label="Of residual"
            value={`${draft.hedgePct}%`}
            min={0}
            max={150}
            step={5}
            current={draft.hedgePct}
            onCommit={(v) => patch({ hedgePct: v })}
            hint="Applies only when the clock finds residual outside tolerance. 100% to target. 50% half."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Long contract (buy)</Label>
          <Select
            value={draft.longInstrument[ccy]}
            onValueChange={(v) => patch({ longInstrument: { ...draft.longInstrument, [ccy]: v } })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {choices.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Short contract (sell)</Label>
          <Select
            value={draft.shortInstrument[ccy]}
            onValueChange={(v) => patch({ shortInstrument: { ...draft.shortInstrument, [ccy]: v } })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {choices.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SliderRow
          label={`Each order (${ccy})`}
          value={draft.orderAmountCoin[ccy] ? `${fmtNum(draft.orderAmountCoin[ccy], 2)}` : "full"}
          min={0}
          max={ccy === "BTC" ? 20 : 200}
          step={ccy === "BTC" ? 0.5 : 5}
          current={draft.orderAmountCoin[ccy] ?? 0}
          onCommit={(v) => patch({ orderAmountCoin: { ...draft.orderAmountCoin, [ccy]: v } })}
          hint="Maker slice size in coin. 0 = one order. Unfilled leftover cancels on the next clock."
        />
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm">Run in background</div>
            <div className="text-xs text-muted">
              Required for unattended. Encrypts keys; worker wakes every 1 min and ticks ~45s. Disconnect wipes.
            </div>
          </div>
          <Switch
            checked={draft.stayAlive}
            onCheckedChange={(v) => patch({ stayAlive: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm">Reject if would take</div>
            <div className="text-xs text-muted">Strict maker. Next clock cancels leftover slices.</div>
          </div>
          <Switch checked={draft.rejectPostOnly} onCheckedChange={(v) => patch({ rejectPostOnly: v })} />
        </div>
        <Separator />
        {needArmWord && !snap.armed ? (
          <div className="space-y-1.5">
            <Label htmlFor="arm">Type ARM for mainnet</Label>
            <Input id="arm" value={armConfirm} onChange={(e) => setArmConfirm(e.target.value)} placeholder="ARM" />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy || !paramsPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            disabled={busy || (snap.venue === "mainnet" && !snap.armed && armConfirm !== "ARM")}
            onClick={() => run.mutate()}
          >
            {run.isPending ? "Starting…" : "Save and Run"}
          </Button>
        </div>
        {snap.armed ? (
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => stop.mutate()}>
            Switch Off
          </Button>
        ) : null}
        <p className="text-[11px] text-muted">
          Save writes parameters only. Save and Run arms the loop. Closing this panel without either does nothing.
        </p>
      </div>
    </Card>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  current,
  onCommit,
  hint,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onCommit: (v: number) => void;
  hint?: string;
}) {
  const [local, setLocal] = useState(current);
  useEffect(() => setLocal(current), [current]);
  const body = (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-muted">{value}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[local]}
        onValueChange={(v) => setLocal(v[0] ?? local)}
        onValueCommit={(v) => onCommit(v[0] ?? current)}
      />
    </div>
  );
  if (!hint) return body;
  return <Tooltip content={hint}>{body}</Tooltip>;
}

function FillsTab({ snap }: { snap: Snapshot }) {
  return (
    <div className="space-y-4">
      <HedgeRvStrip snap={snap} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle">Session index RV</div>
          <SessionRvChart snap={snap} />
        </div>
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle">Path vol</div>
          <PathVolChart series={snap.series} />
        </div>
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle">Fill rate</div>
          <FillRateChart cycles={snap.cycles} />
        </div>
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle">Capture</div>
          <CaptureChart cycles={snap.cycles} />
        </div>
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle">Cumulative fill</div>
          <CumFillChart cycles={snap.cycles} />
        </div>
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle">Capture histogram</div>
          <CaptureHist cycles={snap.cycles} />
        </div>
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle">Residual vs fill</div>
          <ResidualVsFill cycles={snap.cycles} />
        </div>
      </div>
    </div>
  );
}

function EvalPanel({ snap, setSnap }: { snap: Snapshot; setSnap: (s: Snapshot) => void }) {
  const coach = useMutation({
    mutationFn: () => runCoach(),
    onSuccess: setSnap,
    onError: (e: Error) => toast.error(e.message),
  });
  const best = useMemo(() => {
    if (!snap.counterfactuals.length) return null;
    return [...snap.counterfactuals].sort((a, b) => a.estCostUsd * a.residualRms - b.estCostUsd * b.residualRms)[0];
  }, [snap.counterfactuals]);

  return (
    <div className="space-y-6">
      <ScoreRing quality={snap.quality} />
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle">What the tuner thinks</div>
        <ul className="space-y-2 text-sm text-muted">
          {snap.suggestions.map((s) => (
            <li key={s} className="border-l-2 border-border pl-3">
              {s}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle">Interval counterfactual</div>
        <IntervalBars rows={snap.counterfactuals} />
        {best ? (
          <p className="mt-2 text-xs text-muted">
            Lowest cost×risk: {best.intervalSec}s · {fmtUsd(best.estCostUsd, 0)} · residual RMS {fmtNum(best.residualRms, 3)}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">Switch On and let a few cycles run.</p>
        )}
      </div>
      <div>
        <Button variant="secondary" onClick={() => coach.mutate()} disabled={coach.isPending}>
          {coach.isPending ? "Evaluating…" : "Run coach"}
        </Button>
        {snap.coach ? (
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-sans text-sm text-fg">
            {snap.coach.text}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
