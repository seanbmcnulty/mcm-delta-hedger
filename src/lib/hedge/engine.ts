import {
  CURRENCIES,
  DEFAULT_CONFIG,
  PERP,
  type AccountSlice,
  type Alert,
  type AlertKind,
  type AlertSeverity,
  type CircuitState,
  type Currency,
  type CycleRecord,
  type Health,
  type HedgeConfig,
  type IndexSource,
  type OrderBook,
  type PolicyChange,
  type Position,
  type SeriesPoint,
  type Snapshot,
  type TapeEvent,
  type TickSource,
  type Venue,
  type WorkingOrder,
} from "./types";
import { PaperWorld } from "./paper";
import type { DeribitClient } from "@/lib/deribit/client.server";
import {
  captureBps,
  clamp,
  ddhCurrent,
  ddhFire,
  ddhHedgeUsd,
  ddhThresholds,
  deviationDelta,
  hedgeInstrument,
  includedPositions,
  isKeelLabel,
  makeLabel,
  makerPrice,
  splitNotional,
  sumGreeks,
} from "./math";
import { freqFromSec, secFromFreq, snapInterval } from "./rv";
import { autoTune, counterfactuals, qualityFromCycles, suggestionsFrom } from "./evaluate";
import { maskUrl, redact } from "./redact";

const EMPTY_ACCOUNT: AccountSlice = { equity: 0, margin: 0, available: 0, deltaTotal: 0 };
const CIRCUIT_LIMIT = 5;
const CIRCUIT_COOL_MS = 30_000;
const WATCHDOG_MS = 20_000;
const DASH_STALE_MS = 45_000;
const BOOK_STALE_MS = 4_000;
const INDEX_DIVERGE = 0.008;

function cloneConfig(c: HedgeConfig): HedgeConfig {
  const threshold = { BTC: c.threshold?.BTC ?? 0.1, ETH: c.threshold?.ETH ?? 1 };
  return {
    ...c,
    threshold,
    thresholdPos: {
      BTC: c.thresholdPos?.BTC ?? threshold.BTC,
      ETH: c.thresholdPos?.ETH ?? threshold.ETH,
    },
    thresholdNeg: {
      BTC: c.thresholdNeg?.BTC ?? threshold.BTC,
      ETH: c.thresholdNeg?.ETH ?? threshold.ETH,
    },
    maxHedgeUsd: { BTC: c.maxHedgeUsd?.BTC ?? 250_000, ETH: c.maxHedgeUsd?.ETH ?? 150_000 },
    targetDelta: { BTC: c.targetDelta?.BTC ?? 0, ETH: c.targetDelta?.ETH ?? 0 },
    currencies: [...(c.currencies ?? ["BTC", "ETH"])],
    hedgeSkip: [...(c.hedgeSkip ?? [])],
    hedgeFull: c.hedgeFull !== false,
    autoSelectNew: c.autoSelectNew !== false,
    edition: "pro",
    deltaUnit: c.deltaUnit === "usd" ? "usd" : "coin",
    longInstrument: {
      BTC: c.longInstrument?.BTC || PERP.BTC,
      ETH: c.longInstrument?.ETH || PERP.ETH,
    },
    shortInstrument: {
      BTC: c.shortInstrument?.BTC || PERP.BTC,
      ETH: c.shortInstrument?.ETH || PERP.ETH,
    },
    orderAmountCoin: {
      BTC: c.orderAmountCoin?.BTC ?? 0,
      ETH: c.orderAmountCoin?.ETH ?? 0,
    },
    hedgeTimeoutSec: c.hedgeTimeoutSec ?? 60,
    stayAlive: c.stayAlive === true,
  };
}

export class HedgeEngine {
  venue: Venue = "paper";
  armed = false;
  connected = false;
  clientIdMasked = "";
  config: HedgeConfig = cloneConfig(DEFAULT_CONFIG);
  positions: Position[] = [];
  orders: WorkingOrder[] = [];
  cycles: CycleRecord[] = [];
  tape: TapeEvent[] = [];
  series: SeriesPoint[] = [];
  policyLog: PolicyChange[] = [];
  lastCycleAt = 0;
  lastQuoteAt = 0;
  lastTickAt = 0;
  lastClientAt = 0;
  lastServerAt = 0;
  lastOkAt = Date.now();
  lastWakeAt = 0;
  startedAt = Date.now();
  indices: Record<Currency, number> = { BTC: 0, ETH: 0 };
  books: Record<string, OrderBook> = {};
  account: Record<Currency, AccountSlice> = { BTC: EMPTY_ACCOUNT, ETH: EMPTY_ACCOUNT };
  lastError: string | null = null;
  cycleSeq = 1;
  coach: Snapshot["coach"] = null;
  liveStale = false;
  paper: PaperWorld;
  deribit: DeribitClient | null = null;
  webhookUrl: string | null = null;
  indexSource: IndexSource = "paper";
  circuit: CircuitState = "closed";
  circuitOpenedAt = 0;
  consecutiveFailures = 0;
  alerts: Alert[] = [];
  serverLoop = false;
  private busy = false;
  private lastTuneAt = 0;
  private unhedgedUsd = 0;
  private hedgedUsd = 0;
  private lastMark: Record<Currency, number> = { BTC: 0, ETH: 0 };
  private lastDelta: Record<Currency, number> = { BTC: 0, ETH: 0 };
  private lastTuneN = 0;
  private alertSeq = 1;
  private lastRaise: Record<string, number> = {};
  private pendingNotify: Alert[] = [];
  private skipped = new Set<Currency>();
  private seenInstruments = new Set<string>();
  private cyclePlan = new Map<
    number,
    { slices: number[]; next: number; instrument: string; timeoutAt: number; side: "buy" | "sell" }
  >();

  constructor() {
    this.paper = new PaperWorld(Date.now());
    this.indices = { ...this.paper.indices };
    const now = Date.now();
    this.positions = this.paper.positions(now);
    for (const inst of this.hedgeInstruments()) {
      this.books[inst] = this.paper.book(inst, now);
    }
    this.refreshAccount();
    this.log("info", "Paper book ready — short gamma vs Deribit-style perps. Save and Run, or paste keys.");
  }

  warmup(now: number) {
    const start = now - 90_000;
    this.paper.rewind(start);
    this.series = [];
    this.unhedgedUsd = 0;
    this.hedgedUsd = 0;
    this.lastMark = { BTC: 0, ETH: 0 };
    this.lastDelta = { BTC: 0, ETH: 0 };
    for (let t = start; t <= now; t += 3000) {
      this.paper.advance(t);
      this.indices = { ...this.paper.indices };
      this.positions = this.paper.positions(t);
      for (const inst of this.hedgeInstruments()) {
        this.books[inst] = this.paper.book(inst, t);
      }
      this.recordSeries(t);
    }
    this.refreshAccount();
  }

  log(level: TapeEvent["level"], message: string, currency?: Currency) {
    this.tape.unshift({ t: Date.now(), level, message: redact(message), currency });
    if (this.tape.length > 180) this.tape.length = 180;
  }

  health(): Health {
    const now = Date.now();
    const dashboardStale =
      this.armed &&
      this.lastClientAt > 0 &&
      now - this.lastClientAt > DASH_STALE_MS &&
      !this.config.stayAlive;
    const unackedCritical = this.alerts.filter((a) => !a.acked && a.severity === "critical").length;
    let status: Health["status"] = "ok";
    if (this.circuit === "open" || unackedCritical > 0 || this.consecutiveFailures >= 3) status = "critical";
    else if (
      this.consecutiveFailures > 0 ||
      dashboardStale ||
      this.circuit === "half_open" ||
      (this.config.stayAlive &&
        this.armed &&
        this.lastWakeAt > 0 &&
        now - this.lastWakeAt > 180_000)
    )
      status = "degraded";
    const cooldownMs =
      this.circuit === "open" ? Math.max(0, CIRCUIT_COOL_MS - (now - this.circuitOpenedAt)) : 0;
    return {
      status,
      circuit: this.circuit,
      consecutiveFailures: this.consecutiveFailures,
      lastOkAt: this.lastOkAt,
      lastClientAt: this.lastClientAt,
      lastServerAt: this.lastServerAt,
      serverLoop: this.serverLoop,
      dashboardStale,
      unackedCritical,
      indexSource: this.indexSource,
      cooldownMs,
      webhook: Boolean(this.webhookUrl),
      stayAlive: this.config.stayAlive,
      lastWakeAt: this.lastWakeAt,
    };
  }

  snapshot(): Snapshot {
    const greeks = {
      BTC: sumGreeks(this.positions, "BTC"),
      ETH: sumGreeks(this.positions, "ETH"),
    };
    const quality = qualityFromCycles(this.cycles);
    const suggestions = suggestionsFrom({
      quality,
      config: this.config,
      gamma: { BTC: greeks.BTC.gamma, ETH: greeks.ETH.gamma },
    });
    const nextCycleAt = this.armed
      ? this.lastCycleAt
        ? this.lastCycleAt + this.config.intervalSec * 1000
        : Date.now()
      : 0;
    const health = this.health();
    return {
      venue: this.venue,
      armed: this.armed,
      connected: this.connected,
      clientIdMasked: this.clientIdMasked,
      config: cloneConfig(this.config),
      now: Date.now(),
      nextCycleAt,
      lastTickAt: this.lastTickAt,
      lastError: this.lastError,
      indices: { ...this.indices },
      books: { ...this.books },
      greeks,
      account: {
        BTC: { ...this.account.BTC },
        ETH: { ...this.account.ETH },
      },
      positions: this.positions.map((p) => ({ ...p })),
      orders: this.orders.map((o) => ({ ...o })),
      cycles: this.cycles.slice(0, 80),
      tape: this.tape.slice(0, 80),
      series: this.series.slice(-360),
      policyLog: this.policyLog.slice(0, 40),
      quality,
      counterfactuals: counterfactuals(this.series),
      suggestions,
      coach: this.coach,
      liveStale: health.dashboardStale,
      rv: null,
      health,
      alerts: this.alerts.slice(0, 60),
      webhookMasked: this.webhookUrl ? maskUrl(this.webhookUrl) : "",
      stayAlivePersisted: false,
    };
  }

  raise(input: {
    severity: AlertSeverity;
    kind: AlertKind;
    title: string;
    detail: string;
    currency?: Currency;
  }) {
    const key = `${input.kind}:${input.currency ?? ""}`;
    const minGap = input.severity === "critical" ? 8_000 : 20_000;
    const last = this.lastRaise[key] ?? 0;
    if (Date.now() - last < minGap) return null;
    this.lastRaise[key] = Date.now();
    const alert: Alert = {
      id: `a-${Date.now()}-${this.alertSeq++}`,
      t: Date.now(),
      severity: input.severity,
      kind: input.kind,
      title: input.title,
      detail: redact(input.detail),
      currency: input.currency,
      acked: false,
    };
    this.alerts.unshift(alert);
    if (this.alerts.length > 120) this.alerts.length = 120;
    this.pendingNotify.push(alert);
    const tapeLevel = input.severity === "critical" ? "error" : input.severity === "warn" ? "warn" : "info";
    this.log(tapeLevel, `${input.title}: ${alert.detail}`, input.currency);
    if (input.severity === "critical") this.lastError = alert.detail;
    return alert;
  }

  drainNotify() {
    const q = this.pendingNotify;
    this.pendingNotify = [];
    return q;
  }

  ackAlerts(ids?: string[]) {
    if (!ids || ids.length === 0) {
      this.alerts = this.alerts.map((a) => ({ ...a, acked: true }));
      return;
    }
    const set = new Set(ids);
    this.alerts = this.alerts.map((a) => (set.has(a.id) ? { ...a, acked: true } : a));
  }

  setConfig(patch: Partial<HedgeConfig>) {
    this.config = cloneConfig({
      ...this.config,
      ...patch,
      threshold: { ...this.config.threshold, ...(patch.threshold ?? {}) },
      thresholdPos: { ...this.config.thresholdPos, ...(patch.thresholdPos ?? {}) },
      thresholdNeg: { ...this.config.thresholdNeg, ...(patch.thresholdNeg ?? {}) },
      maxHedgeUsd: { ...this.config.maxHedgeUsd, ...(patch.maxHedgeUsd ?? {}) },
      targetDelta: { ...this.config.targetDelta, ...(patch.targetDelta ?? {}) },
      currencies: patch.currencies ? [...patch.currencies] : [...this.config.currencies],
      hedgeSkip: patch.hedgeSkip ? [...patch.hedgeSkip] : [...(this.config.hedgeSkip ?? [])],
      longInstrument: { ...this.config.longInstrument, ...(patch.longInstrument ?? {}) },
      shortInstrument: { ...this.config.shortInstrument, ...(patch.shortInstrument ?? {}) },
      orderAmountCoin: { ...this.config.orderAmountCoin, ...(patch.orderAmountCoin ?? {}) },
    });
    this.config.intervalSec = snapInterval(this.config.intervalSec);
    this.config.quoteRefreshSec = clamp(Math.round(this.config.quoteRefreshSec), 2, 30);
    this.config.quoteOffsetTicks = clamp(Math.round(this.config.quoteOffsetTicks), -3, 8);
    this.config.hedgePct = clamp(Math.round(typeof this.config.hedgePct === "number" ? this.config.hedgePct : 100), 0, 150);
    this.config.hedgeTimeoutSec = clamp(Math.round(this.config.hedgeTimeoutSec || 60), 15, 300);
    this.config.hedgeFull = this.config.hedgeFull !== false;
    this.config.autoSelectNew = this.config.autoSelectNew !== false;
    this.config.hedgeSkip = Array.isArray(this.config.hedgeSkip) ? [...this.config.hedgeSkip] : [];
    const td = this.config.targetDelta;
    td.BTC = Number.isFinite(td.BTC) ? td.BTC : 0;
    td.ETH = Number.isFinite(td.ETH) ? td.ETH : 0;
    this.config.edition = "pro";
    this.config.stayAlive = this.config.stayAlive === true;
    for (const ccy of CURRENCIES) {
      this.config.thresholdPos[ccy] = Math.max(0, this.config.thresholdPos[ccy] || this.config.threshold[ccy]);
      this.config.thresholdNeg[ccy] = Math.max(0, this.config.thresholdNeg[ccy] || this.config.threshold[ccy]);
      this.config.orderAmountCoin[ccy] = Math.max(0, this.config.orderAmountCoin[ccy] ?? 0);
    }
    if (this.config.freqPolicy === "min_rv") {
      this.config.intervalSec = secFromFreq(freqFromSec(this.config.intervalSec));
    } else if (this.config.freqPolicy !== "manual") {
      this.config.freqPolicy = "manual";
    }
    const unit = this.config.deltaUnit === "usd" ? "USD" : "coin";
    this.log(
      "info",
      `Config · ${unit} · clock ${this.config.intervalSec}s · ratio ${this.config.hedgePct}% · Δ* BTC ${td.BTC} ETH ${td.ETH}`,
    );
  }

  arm() {
    if (this.venue !== "paper" && !this.connected) {
      throw new Error("Connect API keys before arming a live venue.");
    }
    if (this.circuit === "open") {
      const left = CIRCUIT_COOL_MS - (Date.now() - this.circuitOpenedAt);
      if (left > 0) throw new Error(`Circuit cooling down — wait ${Math.ceil(left / 1000)}s before re-arm.`);
      this.circuit = "half_open";
      this.log("warn", "Circuit half-open — next clean tick will close it.");
    }
    this.armed = true;
    this.lastCycleAt = 0;
    this.consecutiveFailures = 0;
    this.log("info", `Switch On · ${this.venue} · clock ${this.config.intervalSec}s then ±tolerance · ${this.config.hedgePct}% · maker`);
  }

  disarm() {
    this.armed = false;
    this.log("warn", "Switch Off — working hedger orders left resting until Kill or next run.");
  }

  async kill(fromTrip = false) {
    this.armed = false;
    this.cyclePlan.clear();
    await this.cancelAllKeel();
    if (!fromTrip) {
      this.raise({
        severity: "warn",
        kind: "kill",
        title: "Kill",
        detail: "All hedger maker orders cancelled.",
      });
    }
  }

  async trip(kind: AlertKind, detail: string) {
    this.circuit = "open";
    this.circuitOpenedAt = Date.now();
    this.armed = false;
    this.raise({
      severity: "critical",
      kind: kind === "watchdog" || kind === "auth_fail" || kind === "tick_fail" ? kind : "circuit_open",
      title: "Fail-safe trip",
      detail,
    });
    await this.cancelAllKeel();
  }

  async watchdog(now = Date.now()) {
    if (!this.armed) return;
    if (this.circuit === "open") return;
    if (now - this.lastOkAt > WATCHDOG_MS) {
      await this.trip("watchdog", `No successful hedge tick in ${Math.round(WATCHDOG_MS / 1000)}s. Fail-safe kill.`);
    }
  }

  private async cancelAllKeel() {
    const now = Date.now();
    if (this.venue === "paper") {
      this.paper.cancelKeel(now);
      this.orders = this.paper.openOrders();
      this.log("warn", "Kill — cancelled all hedger maker orders.");
      return;
    }
    const d = this.deribit;
    if (!d) {
      this.orders = this.orders.map((o) =>
        o.state === "open" && isKeelLabel(o.label) ? { ...o, state: "cancelled" as const } : o,
      );
      return;
    }
    for (let pass = 0; pass < 2; pass++) {
      const open = this.orders.filter((o) => o.state === "open" && isKeelLabel(o.label));
      const labels = [...new Set(open.map((o) => o.label))];
      await Promise.allSettled(
        labels.map((l) => d.cancelByLabel(l, l.includes("-ETH-") ? "ETH" : "BTC")),
      );
      await Promise.allSettled(open.map((o) => d.cancel(o.id)));
      try {
        const [btc, eth] = await Promise.all([d.getOpenOrders("BTC"), d.getOpenOrders("ETH")]);
        this.orders = [...btc, ...eth];
      } catch (err) {
        this.log("error", `Reconcile orders failed: ${redact(err)}`);
        break;
      }
      const leftover = this.orders.filter((o) => o.state === "open" && isKeelLabel(o.label));
      if (!leftover.length) break;
    }
    this.orders = this.orders.map((o) =>
      o.state === "open" && isKeelLabel(o.label) ? { ...o, state: "cancelled" as const } : o,
    );
    this.log("warn", "Kill — cancelled all hedger maker orders (two-pass).");
  }

  async tick(source: TickSource = "client") {
    if (this.busy) return this.snapshot();
    this.busy = true;
    const now = Date.now();
    this.lastTickAt = now;
    if (source === "client") this.lastClientAt = now;
    else this.lastServerAt = now;
    this.skipped = new Set();
    try {
      if (this.venue === "paper") await this.tickPaper(now);
      else await this.tickLive(now);
      this.recordSeries(now);
      this.maybeTune(now);
      this.lastError = null;
      this.liveStale = false;
      this.consecutiveFailures = 0;
      this.lastOkAt = now;
      if (this.config.stayAlive) this.lastWakeAt = now;
      if (this.circuit === "half_open") {
        this.circuit = "closed";
        this.log("info", "Circuit closed — clean tick.");
      }
      if (this.health().dashboardStale) {
        this.raise({
          severity: "warn",
          kind: "dashboard",
          title: "Dashboard heartbeat lost",
          detail: "Tab idle — server loop is still hedging.",
        });
      }
    } catch (err) {
      const msg = redact(err);
      this.lastError = msg;
      this.consecutiveFailures += 1;
      this.log("error", msg);
      this.raise({
        severity: this.consecutiveFailures >= 3 ? "critical" : "warn",
        kind: "tick_fail",
        title: "Tick failed",
        detail: msg,
      });
      if (this.consecutiveFailures >= CIRCUIT_LIMIT && this.armed) {
        await this.trip("tick_fail", `${this.consecutiveFailures} consecutive tick failures. Fail-safe kill.`);
      }
    } finally {
      this.busy = false;
    }
    return this.snapshot();
  }

  private async tickPaper(now: number) {
    this.paper.advance(now);
    this.indices = { ...this.paper.indices };
    this.indexSource = "paper";
    for (const inst of this.hedgeInstruments()) {
      try {
        this.books[inst] = this.paper.book(inst, now);
      } catch {
        /* unknown paper instrument */
      }
    }
    this.positions = this.paper.positions(now);
    this.orders = this.paper.openOrders();
    this.refreshAccount();
    if (!this.armed) return;
    if (this.circuit === "open") return;
    await this.manage(now);
  }

  private hedgeInstruments(): string[] {
    const set = new Set<string>([PERP.BTC, PERP.ETH]);
    for (const ccy of CURRENCIES) {
      set.add(this.config.longInstrument[ccy] || PERP[ccy]);
      set.add(this.config.shortInstrument[ccy] || PERP[ccy]);
    }
    for (const name of this.paper.datedNames.BTC) set.add(name);
    for (const name of this.paper.datedNames.ETH) set.add(name);
    return [...set];
  }

  private deltaCoin(ccy: Currency) {
    const g = sumGreeks(this.hedgeBook(), ccy);
    const full = this.config.hedgeFull !== false;
    if (this.venue !== "paper" && full) {
      const v = this.account[ccy]?.deltaTotal;
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return g.delta;
  }

  private planFor(ccy: Currency) {
    const g = sumGreeks(this.hedgeBook(), ccy);
    const index = this.indices[ccy] || 0;
    const unit = this.config.deltaUnit;
    const target = this.config.targetDelta[ccy] ?? 0;
    const deltaCoin = this.deltaCoin(ccy);
    const greeks = { ...g, delta: deltaCoin };
    const current = ddhCurrent(deltaCoin, index, unit);
    const thr = ddhThresholds(this.config, ccy);
    const dev = deviationDelta(current, target);
    const fire = ddhFire(dev.raw, thr.pos, thr.neg);
    const ratio = clamp(this.config.hedgePct, 0, 150) / 100;
    const usdRaw = fire ? ddhHedgeUsd({ raw: dev.raw, index, ratio, unit }) : 0;
    return { g: greeks, index, unit, target, current, thr, dev, fire, ratio, usdRaw };
  }

  private async tickLive(now: number) {
    const d = this.deribit;
    if (!d) throw new Error("Not connected.");

    type Box<T> = { ok: true; v: T } | { ok: false; e: string };
    const wrap = async <T>(p: Promise<T>, name: string): Promise<Box<T>> => {
      try {
        return { ok: true, v: await p };
      } catch (err) {
        return { ok: false, e: `${name}: ${redact(err)}` };
      }
    };

    const [btcIdx, ethIdx, btcBook, ethBook, btcPos, ethPos, btcAcct, ethAcct, btcOrd, ethOrd] = await Promise.all([
      wrap(d.getIndex("BTC"), "BTC index"),
      wrap(d.getIndex("ETH"), "ETH index"),
      wrap(d.getBook(PERP.BTC), "BTC book"),
      wrap(d.getBook(PERP.ETH), "ETH book"),
      wrap(d.getPositions("BTC"), "BTC positions"),
      wrap(d.getPositions("ETH"), "ETH positions"),
      wrap(d.getAccount("BTC"), "BTC account"),
      wrap(d.getAccount("ETH"), "ETH account"),
      wrap(d.getOpenOrders("BTC"), "BTC orders"),
      wrap(d.getOpenOrders("ETH"), "ETH orders"),
    ]);

    const boxes = [btcIdx, ethIdx, btcBook, ethBook, btcPos, ethPos, btcAcct, ethAcct, btcOrd, ethOrd];
    const fails = boxes.filter((b) => !b.ok) as Array<{ ok: false; e: string }>;
    if (fails.length >= 6) throw new Error(`Live snapshot degraded (${fails.length}/10). ${fails[0]?.e ?? ""}`);
    for (const f of fails) {
      this.log("warn", f.e);
    }
    if (fails.length) {
      this.raise({
        severity: fails.length >= 3 ? "warn" : "info",
        kind: "stale",
        title: "Partial venue snapshot",
        detail: `${fails.length} of 10 live calls failed. Hedging the healthy currency only.`,
      });
    }

    if (!btcPos.ok && !ethPos.ok) throw new Error("Both position fetches failed — refusing to hedge blind.");

    if (btcIdx.ok) this.indices.BTC = btcIdx.v;
    if (ethIdx.ok) this.indices.ETH = ethIdx.v;
    this.indexSource = fails.some((f) => f.e.includes("index")) ? "fallback" : "primary";
    if (btcBook.ok) this.books[PERP.BTC] = btcBook.v;
    if (ethBook.ok) this.books[PERP.ETH] = ethBook.v;
    const extraInst = this.hedgeInstruments().filter((i) => i !== PERP.BTC && i !== PERP.ETH);
    if (extraInst.length && d) {
      const extras = await Promise.all(extraInst.map((i) => wrap(d.getBook(i), i)));
      for (let i = 0; i < extraInst.length; i++) {
        const box = extras[i]!;
        if (box.ok) this.books[extraInst[i]!] = box.v;
      }
    }
    const pos: Position[] = [];
    if (btcPos.ok) pos.push(...btcPos.v);
    else this.skipped.add("BTC");
    if (ethPos.ok) pos.push(...ethPos.v);
    else this.skipped.add("ETH");
    this.positions = pos;
    if (btcAcct.ok) this.account.BTC = btcAcct.v;
    if (ethAcct.ok) this.account.ETH = ethAcct.v;
    const ords: WorkingOrder[] = [];
    if (btcOrd.ok) ords.push(...btcOrd.v);
    if (ethOrd.ok) ords.push(...ethOrd.v);
    this.orders = ords.filter((o) => isKeelLabel(o.label) || o.state === "open");
    if (!this.armed) return;
    if (this.circuit === "open") return;
    await this.manage(now);
  }

  private refreshAccount() {
    for (const ccy of CURRENCIES) {
      const g = sumGreeks(this.positions, ccy);
      const equity = ccy === "BTC" ? 12.4 : 84;
      this.account[ccy] = {
        equity,
        margin: Math.abs(g.delta) * 0.08,
        available: equity * 0.7,
        deltaTotal: g.delta,
      };
    }
  }

  private bookHealthy(ccy: Currency, now: number, instrument = PERP[ccy]) {
    const book = this.books[instrument] ?? this.books[PERP[ccy]];
    const index = this.indices[ccy];
    if (!book || !index) {
      this.raise({
        severity: "warn",
        kind: "book",
        title: `${ccy} book missing`,
        detail: "Skip hedge this cycle.",
        currency: ccy,
      });
      return false;
    }
    if (this.venue !== "paper" && book.ts > 0 && now - book.ts > BOOK_STALE_MS) {
      this.raise({
        severity: "warn",
        kind: "book",
        title: `${ccy} book stale`,
        detail: `Book age ${((now - book.ts) / 1000).toFixed(1)}s — skip.`,
        currency: ccy,
      });
      return false;
    }
    if (book.mid > 0 && Math.abs(book.mid - index) / index > INDEX_DIVERGE) {
      this.raise({
        severity: "warn",
        kind: "index",
        title: `${ccy} index/mid diverge`,
        detail: `Mid ${book.mid.toFixed(1)} vs index ${index.toFixed(1)} — skip.`,
        currency: ccy,
      });
      return false;
    }
    return true;
  }

  private async manage(now: number) {
    await this.progressOpenCycles(now);
    const due = !this.lastCycleAt || now - this.lastCycleAt >= this.config.intervalSec * 1000;
    if (due) {
      await this.startCycles(now);
      this.lastCycleAt = now;
      this.lastQuoteAt = now;
      return;
    }
    if (now - this.lastQuoteAt >= this.config.quoteRefreshSec * 1000) {
      await this.requote(now);
      this.lastQuoteAt = now;
    }
  }

  private async finishCycle(c: CycleRecord, now: number, reason?: string) {
    const g = sumGreeks(this.hedgeBook(), c.currency);
    const filled = this.filledForCycle(c);
    const working = this.orders.filter(
      (o) => o.state === "open" && o.currency === c.currency && isKeelLabel(o.label) && o.label.startsWith(`keel-${c.currency}-${c.id}`),
    );
    for (const o of working) await this.cancelOrder(o);
    const avgFill = filled.avgFill;
    const side = c.targetUsd < 0 ? "sell" : "buy";
    c.endedAt = now;
    c.endDelta = this.deltaCoin(c.currency);
    c.filledUsd = filled.usd;
    c.avgFill = avgFill;
    c.fillRate = c.targetUsd ? Math.min(1, filled.usd / Math.abs(c.targetUsd)) : 1;
    c.captureBps = avgFill ? captureBps(side, avgFill, c.mid) : null;
    c.adverseBps = avgFill ? captureBps(side, this.indices[c.currency], avgFill) * -1 : null;
    this.cyclePlan.delete(c.id);
    this.log(
      "info",
      `${c.currency} cycle #${c.id} ${reason ?? "done"} · filled ${c.filledUsd.toFixed(0)} USD · residual Δ ${g.delta.toFixed(4)} · fill ${(c.fillRate * 100).toFixed(0)}%`,
      c.currency,
    );
    const plan = this.planFor(c.currency);
    const target = this.config.targetDelta[c.currency] ?? 0;
    const expectedCoin = target + (c.startDelta - target) * (1 - plan.ratio);
    const dust = (c.currency === "BTC" ? 10 : 1) / Math.max(1, this.indices[c.currency] || 1);
    const liveDelta = this.deltaCoin(c.currency);
    if (Math.abs(liveDelta - expectedCoin) > Math.max(dust * 8, 0.02) && c.fillRate > 0.5) {
      this.raise({
        severity: "critical",
        kind: "residual",
        title: `${c.currency} residual after clock`,
        detail: `Δ ${liveDelta.toFixed(4)} after ${this.config.hedgePct}% hedge (expected ~${expectedCoin.toFixed(4)}).`,
        currency: c.currency,
      });
    }
  }

  private async progressOpenCycles(now: number) {
    const open = this.cycles.filter((c) => c.endedAt === null);
    for (const c of open) {
      const plan = this.cyclePlan.get(c.id);
      const filled = this.filledForCycle(c);
      c.filledUsd = filled.usd;
      const working = this.orders.filter(
        (o) => o.state === "open" && o.label.startsWith(`keel-${c.currency}-${c.id}`),
      );

      if (plan && now >= plan.timeoutAt) {
        this.log(
          "policy",
          `${c.currency} slice timeout — requote until next clock`,
          c.currency,
        );
        plan.timeoutAt = now + Math.max(this.config.hedgeTimeoutSec, this.config.intervalSec) * 1000;
      }

      if (plan && working.length === 0) {
        if (plan.next >= plan.slices.length) {
          await this.finishCycle(c, now, "filled");
          continue;
        }
        const slice = plan.slices[plan.next]!;
        plan.next += 1;
        c.orders = plan.next;
        if (!this.bookHealthy(c.currency, now, plan.instrument)) continue;
        const book = this.books[plan.instrument];
        if (!book) continue;
        const tick = c.currency === "BTC" ? 0.5 : 0.05;
        const px = makerPrice({
          side: plan.side,
          bestBid: book.bestBid,
          bestAsk: book.bestAsk,
          tick,
          offsetTicks: this.config.quoteOffsetTicks,
        });
        if (px === null) continue;
        const label = `${makeLabel(c.currency, c.id)}-${plan.next}`;
        await this.place(c.currency, plan.side, slice, px, label, now, plan.instrument);
        this.log(
          "info",
          `${c.currency} slice ${plan.next}/${plan.slices.length} ${plan.side} ${slice.toFixed(0)} USD @ ${px} ${plan.instrument}`,
          c.currency,
        );
      }
    }
  }

  private async closeOpenCycles(now: number, reason = "closed") {
    const open = this.cycles.filter((c) => c.endedAt === null);
    for (const c of open) await this.finishCycle(c, now, reason);
  }

  private filledForCycle(c: CycleRecord) {
    const mine = this.orders.filter(
      (o) => o.label === makeLabel(c.currency, c.id) || o.label.startsWith(`keel-${c.currency}-${c.id}`),
    );
    const usd = mine.reduce((s, o) => s + o.filledUsd, 0);
    const notional = mine.reduce((s, o) => s + o.filledUsd * o.price, 0);
    return { usd, avgFill: usd > 0 ? notional / usd : null };
  }

  private noteNewPositions() {
    for (const p of this.positions) {
      if (this.seenInstruments.has(p.instrument)) continue;
      this.seenInstruments.add(p.instrument);
      if (!this.config.hedgeFull && !this.config.autoSelectNew) {
        if (!this.config.hedgeSkip.includes(p.instrument)) {
          this.config.hedgeSkip = [...this.config.hedgeSkip, p.instrument];
        }
      }
    }
  }

  private hedgeBook() {
    this.noteNewPositions();
    return includedPositions(this.positions, this.config.hedgeFull !== false, this.config.hedgeSkip ?? []);
  }

  private async startCycles(now: number) {
    await this.closeOpenCycles(now, "clock rollover");
    for (const ccy of this.config.currencies) {
      if (this.skipped.has(ccy)) {
        this.log("warn", `${ccy} skipped — stale positions this tick`, ccy);
        continue;
      }
      const live = this.planFor(ccy);
      const minUsd = ccy === "BTC" ? 10 : 1;
      if (!live.fire) {
        this.log(
          "info",
          `${ccy} clock ${this.config.intervalSec}s · Δ ${live.g.delta.toFixed(4)} residual ${live.dev.raw.toFixed(4)} inside +${live.thr.pos}/−${live.thr.neg} — skip`,
          ccy,
        );
        continue;
      }
      if (Math.abs(live.usdRaw) < minUsd) {
        this.log(
          "info",
          `${ccy} clock · hedge ${live.usdRaw.toFixed(0)} USD under min ${minUsd} — skip`,
          ccy,
        );
        continue;
      }
      const instrument = hedgeInstrument(this.config, ccy, live.fire);
      if (!this.bookHealthy(ccy, now, instrument)) continue;
      const book = this.books[instrument] ?? this.books[PERP[ccy]];
      if (!book || !live.index) continue;
      if (live.ratio <= 0) {
        this.log("info", `${ccy} hedge ratio 0% — observe only`, ccy);
        continue;
      }
      const capped = Math.min(Math.abs(live.usdRaw), this.config.maxHedgeUsd[ccy]);
      const sliceCoin = this.config.orderAmountCoin[ccy];
      const sliceUsd = sliceCoin > 0 ? sliceCoin * live.index : 0;
      const slices = splitNotional(capped, sliceUsd, minUsd);
      if (!slices.length) {
        this.log("warn", `${ccy} hedge dust ${capped.toFixed(0)} USD under min`, ccy);
        continue;
      }
      const side: "buy" | "sell" = live.fire === "long" ? "buy" : "sell";
      const tick = ccy === "BTC" ? 0.5 : 0.05;
      const px = makerPrice({
        side,
        bestBid: book.bestBid,
        bestAsk: book.bestAsk,
        tick,
        offsetTicks: this.config.quoteOffsetTicks,
      });
      if (px === null) {
        this.log("warn", `${ccy} empty book — skip`, ccy);
        continue;
      }
      const id = this.cycleSeq++;
      const amount = slices.reduce((s, x) => s + x, 0);
      const dir = live.fire === "short" ? "short contract (+dev)" : "long contract (−dev)";
      this.cycles.unshift({
        id,
        startedAt: now,
        endedAt: null,
        currency: ccy,
        startDelta: live.g.delta,
        endDelta: null,
        targetUsd: side === "buy" ? amount : -amount,
        filledUsd: 0,
        mid: book.mid,
        avgFill: null,
        captureBps: null,
        adverseBps: null,
        fillRate: 0,
        orders: 1,
        reason: `clock ${this.config.intervalSec}s · outside +${live.thr.pos}/−${live.thr.neg} · ${dir} · ${this.config.hedgePct}% → Δ* ${live.target}`,
        instrument,
      });
      if (this.cycles.length > 200) this.cycles.length = 200;
      this.cyclePlan.set(id, {
        slices,
        next: 1,
        instrument,
        timeoutAt: now + Math.max(this.config.hedgeTimeoutSec, this.config.intervalSec) * 1000,
        side,
      });
      const label = `${makeLabel(ccy, id)}-1`;
      await this.place(ccy, side, slices[0]!, px, label, now, instrument);
      this.log(
        "info",
        `${ccy} clock ${this.config.intervalSec}s · ${dir} ${side} ${slices[0]!.toFixed(0)}/${amount.toFixed(0)} USD @ ${px} ${instrument} · Δ ${live.g.delta.toFixed(4)} → ${live.target}`,
        ccy,
      );
    }
  }

  private async requote(now: number) {
    for (const o of this.orders.filter((x) => x.state === "open" && isKeelLabel(x.label))) {
      if (!this.bookHealthy(o.currency, now, o.instrument)) continue;
      const book = this.books[o.instrument];
      if (!book) continue;
      const tick = o.currency === "BTC" ? 0.5 : 0.05;
      const px = makerPrice({
        side: o.side,
        bestBid: book.bestBid,
        bestAsk: book.bestAsk,
        tick,
        offsetTicks: this.config.quoteOffsetTicks,
      });
      if (px === null) continue;
      if (Math.abs(px - o.price) < tick * 0.5) continue;
      await this.replace(o, px, now);
      this.log("info", `Requote ${o.currency} ${o.side} ${o.remainingUsd.toFixed(0)} @ ${px}`, o.currency);
    }
  }

  private async place(
    ccy: Currency,
    side: "buy" | "sell",
    amount: number,
    price: number,
    label: string,
    now: number,
    instrument = PERP[ccy],
  ) {
    if (this.venue === "paper") {
      const order = this.paper.placeMaker({
        instrument,
        side,
        price,
        amountUsd: amount,
        now,
        label,
        rejectPostOnly: this.config.rejectPostOnly,
      });
      if (order.state === "rejected") {
        this.log("warn", `${ccy} post-only reject @ ${price}`, ccy);
        return;
      }
      this.orders = this.paper.openOrders();
      return;
    }
    const d = this.deribit;
    if (!d) throw new Error("Not connected.");
    try {
      const raw = await d.buySell({
        side,
        instrument,
        amount,
        price,
        label,
        rejectPostOnly: this.config.rejectPostOnly,
      });
      this.orders.unshift({
        id: raw.order_id,
        instrument,
        currency: ccy,
        side,
        price: Number(raw.price),
        amountUsd: raw.amount,
        filledUsd: raw.filled_amount,
        remainingUsd: raw.amount - raw.filled_amount,
        createdAt: now,
        updatedAt: now,
        state: raw.order_state === "filled" ? "filled" : "open",
        label: raw.label || label,
        postOnly: true,
      });
    } catch (err) {
      const msg = redact(err);
      this.raise({
        severity: "warn",
        kind: "place_fail",
        title: `${ccy} place failed`,
        detail: msg,
        currency: ccy,
      });
    }
  }

  private async replace(order: WorkingOrder, price: number, now: number) {
    if (this.venue === "paper") {
      this.paper.cancel(order.id, now);
      const fresh = this.paper.placeMaker({
        instrument: order.instrument,
        side: order.side,
        price,
        amountUsd: order.remainingUsd,
        now,
        label: order.label,
        rejectPostOnly: this.config.rejectPostOnly,
      });
      if (fresh.state === "rejected") this.log("warn", `Requote rejected ${order.currency} @ ${price}`, order.currency);
      this.orders = this.paper.openOrders();
      return;
    }
    const d = this.deribit;
    if (!d) return;
    try {
      await d.edit(order.id, order.remainingUsd, price, this.config.rejectPostOnly);
      order.price = price;
      order.updatedAt = now;
    } catch {
      try {
        await d.cancel(order.id);
        await this.place(order.currency, order.side, order.remainingUsd, price, order.label, now);
      } catch (err) {
        this.log("error", `Replace failed: ${redact(err)}`, order.currency);
      }
    }
  }

  private async cancelOrder(order: WorkingOrder) {
    if (this.venue === "paper") {
      this.paper.cancel(order.id, Date.now());
      this.orders = this.paper.openOrders();
      return;
    }
    try {
      await this.deribit?.cancel(order.id);
    } catch {
      try {
        await this.deribit?.cancelByLabel(order.label, order.currency);
      } catch {
        /* already gone */
      }
    }
  }

  private recordSeries(now: number) {
    const gBtc = sumGreeks(this.hedgeBook(), "BTC");
    const gEth = sumGreeks(this.hedgeBook(), "ETH");
    const btcDelta = this.deltaCoin("BTC");
    const ethDelta = this.deltaCoin("ETH");
    if (this.lastMark.BTC && this.lastMark.ETH) {
      const dSBtc = this.indices.BTC - this.lastMark.BTC;
      const dSEth = this.indices.ETH - this.lastMark.ETH;
      this.unhedgedUsd += this.lastDelta.BTC * dSBtc + this.lastDelta.ETH * dSEth;
      this.hedgedUsd += gBtc.perpDelta * dSBtc + gEth.perpDelta * dSEth;
    }
    this.lastMark = { ...this.indices };
    this.lastDelta = { BTC: gBtc.optionDelta, ETH: gEth.optionDelta };
    this.series.push({
      t: now,
      btcDelta,
      ethDelta,
      btcResidual: btcDelta,
      ethResidual: ethDelta,
      btcIndex: this.indices.BTC,
      ethIndex: this.indices.ETH,
      btcHedgeUsd: this.orders
        .filter((o) => o.currency === "BTC" && o.state === "open")
        .reduce((s, o) => s + o.remainingUsd, 0),
      ethHedgeUsd: this.orders
        .filter((o) => o.currency === "ETH" && o.state === "open")
        .reduce((s, o) => s + o.remainingUsd, 0),
      btcPerpDelta: gBtc.perpDelta,
      ethPerpDelta: gEth.perpDelta,
      unhedgedUsd: this.unhedgedUsd,
      hedgedUsd: this.unhedgedUsd + this.hedgedUsd,
    });
    if (this.series.length > 720) this.series.splice(0, this.series.length - 720);
  }

  private maybeTune(now: number) {
    if (!this.config.autoTune) return;
    if (now - this.lastTuneAt < 8 * this.config.intervalSec * 1000) return;
    const quality = qualityFromCycles(this.cycles);
    if (quality.n < 6 || quality.n === this.lastTuneN) return;
    const gBtc = sumGreeks(this.positions, "BTC");
    const gEth = sumGreeks(this.positions, "ETH");
    const { config, changes } = autoTune(
      this.config,
      quality,
      { BTC: gBtc.gamma, ETH: gEth.gamma },
      now,
    );
    this.lastTuneAt = now;
    this.lastTuneN = quality.n;
    if (!changes.length) return;
    this.config = config;
    this.policyLog.unshift(...changes);
    for (const ch of changes) {
      this.log("policy", `Auto-tune ${ch.field}: ${String(ch.from)} → ${String(ch.to)} · ${ch.reason}`);
    }
  }
}
