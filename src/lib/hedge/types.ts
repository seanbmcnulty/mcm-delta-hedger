import type { FreqId, LookbackId, RvSurface } from "./rv";

export type { FreqId, LookbackId, RvSurface };

export type Venue = "paper" | "testnet" | "mainnet";
export type Currency = "BTC" | "ETH";
export type Side = "buy" | "sell";
export type Kind = "future" | "option" | "spot" | "future_combo" | "option_combo";
export type TickSource = "client" | "server";
export type CircuitState = "closed" | "open" | "half_open";
export type HealthStatus = "ok" | "degraded" | "critical";
export type IndexSource = "primary" | "fallback" | "ticker" | "paper";
export type AlertSeverity = "info" | "warn" | "critical";
export type DdhEdition = "pro";
export type DeltaUnit = "coin" | "usd";
export type AlertKind =
  | "tick_fail"
  | "circuit_open"
  | "auth_fail"
  | "stale"
  | "residual"
  | "kill"
  | "watchdog"
  | "place_fail"
  | "book"
  | "index"
  | "webhook"
  | "test"
  | "dashboard"
  | "reconnect";

export const CURRENCIES: Currency[] = ["BTC", "ETH"];

export const PERP: Record<Currency, string> = {
  BTC: "BTC-PERPETUAL",
  ETH: "ETH-PERPETUAL",
};

export type HedgeConfig = {
  intervalSec: number;
  quoteRefreshSec: number;
  /** Lite symmetric threshold (coin or USD per deltaUnit). */
  threshold: Record<Currency, number>;
  thresholdPos: Record<Currency, number>;
  thresholdNeg: Record<Currency, number>;
  targetDelta: Record<Currency, number>;
  quoteOffsetTicks: number;
  rejectPostOnly: boolean;
  maxHedgeUsd: Record<Currency, number>;
  autoTune: boolean;
  currencies: Currency[];
  targetLookback: LookbackId;
  freqPolicy: "manual" | "min_rv";
  hedgePct: number;
  hedgeFull: boolean;
  hedgeSkip: string[];
  autoSelectNew: boolean;
  edition: DdhEdition;
  deltaUnit: DeltaUnit;
  longInstrument: Record<Currency, string>;
  shortInstrument: Record<Currency, string>;
  /** Each maker slice in coin. 0 = single order (no split). */
  orderAmountCoin: Record<Currency, number>;
  hedgeTimeoutSec: number;
  /** Encrypted keys + 1-min wake. Off = RAM-only session. */
  stayAlive: boolean;
};

export const DEFAULT_CONFIG: HedgeConfig = {
  intervalSec: 60,
  quoteRefreshSec: 5,
  threshold: { BTC: 0.1, ETH: 1 },
  thresholdPos: { BTC: 0.1, ETH: 1 },
  thresholdNeg: { BTC: 0.1, ETH: 1 },
  targetDelta: { BTC: 0, ETH: 0 },
  quoteOffsetTicks: 0,
  rejectPostOnly: true,
  maxHedgeUsd: { BTC: 250_000, ETH: 150_000 },
  autoTune: false,
  currencies: ["BTC", "ETH"],
  targetLookback: "14d",
  freqPolicy: "manual",
  hedgePct: 100,
  hedgeFull: true,
  hedgeSkip: [],
  autoSelectNew: true,
  edition: "pro",
  deltaUnit: "coin",
  longInstrument: { BTC: "BTC-PERPETUAL", ETH: "ETH-PERPETUAL" },
  shortInstrument: { BTC: "BTC-PERPETUAL", ETH: "ETH-PERPETUAL" },
  orderAmountCoin: { BTC: 0, ETH: 0 },
  hedgeTimeoutSec: 60,
  stayAlive: false,
};

export type InstrumentSpec = {
  instrument: string;
  currency: Currency;
  tickSize: number;
  minTradeUsd: number;
  contractSize: number;
};

export type OrderBook = {
  instrument: string;
  bestBid: number;
  bestAsk: number;
  bidSize: number;
  askSize: number;
  mid: number;
  index: number;
  ts: number;
};

export type Position = {
  instrument: string;
  currency: Currency;
  kind: Kind;
  size: number;
  sizeCurrency: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  mark: number;
  avgPrice: number;
  iv?: number;
  strike?: number;
  expiryMs?: number;
  optionType?: "call" | "put";
};

export type WorkingOrder = {
  id: string;
  instrument: string;
  currency: Currency;
  side: Side;
  price: number;
  amountUsd: number;
  filledUsd: number;
  remainingUsd: number;
  createdAt: number;
  updatedAt: number;
  state: "open" | "filled" | "cancelled" | "rejected";
  label: string;
  postOnly: true;
};

export type AccountSlice = {
  equity: number;
  margin: number;
  available: number;
  deltaTotal: number;
};

export type Greeks = {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  optionDelta: number;
  perpDelta: number;
};

export type SeriesPoint = {
  t: number;
  btcDelta: number;
  ethDelta: number;
  btcResidual: number;
  ethResidual: number;
  btcIndex: number;
  ethIndex: number;
  btcHedgeUsd: number;
  ethHedgeUsd: number;
  btcPerpDelta: number;
  ethPerpDelta: number;
  unhedgedUsd: number;
  hedgedUsd: number;
};

export type CycleRecord = {
  id: number;
  startedAt: number;
  endedAt: number | null;
  currency: Currency;
  startDelta: number;
  endDelta: number | null;
  targetUsd: number;
  filledUsd: number;
  mid: number;
  avgFill: number | null;
  captureBps: number | null;
  adverseBps: number | null;
  fillRate: number;
  orders: number;
  reason: string;
  instrument?: string;
};

export type TapeEvent = {
  t: number;
  level: "info" | "fill" | "warn" | "policy" | "error";
  message: string;
  currency?: Currency;
};

export type PolicyChange = {
  t: number;
  field: string;
  from: number | boolean | string;
  to: number | boolean | string;
  reason: string;
};

export type QualityBreakdown = {
  score: number;
  fill: number;
  capture: number;
  residual: number;
  adverse: number;
  n: number;
};

export type Counterfactual = {
  intervalSec: number;
  estCostUsd: number;
  residualRms: number;
  nHedges: number;
};

export type CoachNote = {
  t: number;
  text: string;
};

export type Alert = {
  id: string;
  t: number;
  severity: AlertSeverity;
  kind: AlertKind;
  title: string;
  detail: string;
  currency?: Currency;
  acked: boolean;
};

export type Health = {
  status: HealthStatus;
  circuit: CircuitState;
  consecutiveFailures: number;
  lastOkAt: number;
  lastClientAt: number;
  lastServerAt: number;
  serverLoop: boolean;
  dashboardStale: boolean;
  unackedCritical: number;
  indexSource: IndexSource;
  cooldownMs: number;
  webhook: boolean;
  stayAlive: boolean;
  lastWakeAt: number;
};

export type Snapshot = {
  venue: Venue;
  armed: boolean;
  connected: boolean;
  clientIdMasked: string;
  config: HedgeConfig;
  now: number;
  nextCycleAt: number;
  lastTickAt: number;
  lastError: string | null;
  indices: Record<Currency, number>;
  books: Record<string, OrderBook>;
  greeks: Record<Currency, Greeks>;
  account: Record<Currency, AccountSlice>;
  positions: Position[];
  orders: WorkingOrder[];
  cycles: CycleRecord[];
  tape: TapeEvent[];
  series: SeriesPoint[];
  policyLog: PolicyChange[];
  quality: QualityBreakdown;
  counterfactuals: Counterfactual[];
  suggestions: string[];
  coach: CoachNote | null;
  liveStale: boolean;
  rv: { BTC: RvSurface; ETH: RvSurface } | null;
  health: Health;
  alerts: Alert[];
  webhookMasked: string;
  stayAlivePersisted: boolean;
};

export type ConnectInput = {
  venue: Venue;
  clientId: string;
  clientSecret: string;
  webhookUrl?: string;
};
