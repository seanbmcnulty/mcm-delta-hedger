import {
  PERP,
  type Currency,
  type InstrumentSpec,
  type OrderBook,
  type Position,
  type Side,
  type WorkingOrder,
} from "./types";
import { blackScholes, floorTo, labelPrefix, mulberry32, randn, roundTick } from "./math";

const SPECS: Record<string, InstrumentSpec> = {
  "BTC-PERPETUAL": {
    instrument: "BTC-PERPETUAL",
    currency: "BTC",
    tickSize: 0.5,
    minTradeUsd: 10,
    contractSize: 10,
  },
  "ETH-PERPETUAL": {
    instrument: "ETH-PERPETUAL",
    currency: "ETH",
    tickSize: 0.05,
    minTradeUsd: 1,
    contractSize: 1,
  },
};

type PaperOption = {
  instrument: string;
  currency: Currency;
  strike: number;
  expiryMs: number;
  isCall: boolean;
  size: number;
  iv: number;
  avgPrice: number;
};

type PaperPerp = {
  currency: Currency;
  sizeUsd: number;
  avgPrice: number;
};

function formatExpiry(ms: number) {
  const d = new Date(ms);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const dd = d.getUTCDate();
  const mon = months[d.getUTCMonth()];
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${dd}${mon}${yy}`;
}

function nextFriday(from: number, weeksAhead: number) {
  const d = new Date(from);
  const day = d.getUTCDay();
  let add = (5 - day + 7) % 7;
  if (add === 0) add = 7;
  add += 7 * Math.max(0, weeksAhead - 1);
  d.setUTCDate(d.getUTCDate() + add);
  d.setUTCHours(8, 0, 0, 0);
  return d.getTime();
}

export class PaperWorld {
  indices: Record<Currency, number> = { BTC: 64_200, ETH: 2_460 };
  options: PaperOption[] = [];
  linear: Record<string, PaperPerp> = {
    "BTC-PERPETUAL": { currency: "BTC", sizeUsd: 0, avgPrice: 64_200 },
    "ETH-PERPETUAL": { currency: "ETH", sizeUsd: 0, avgPrice: 2_460 },
  };
  orders = new Map<string, WorkingOrder>();
  seq = 1;
  rng = mulberry32(0x6b65656c);
  lastTrade: Record<Currency, number> = { BTC: 64_200, ETH: 2_460 };
  private lastTs: number;
  datedNames: Record<Currency, string[]> = { BTC: [], ETH: [] };

  constructor(now: number) {
    this.lastTs = now;
    this.registerDated(now);
    this.seedBook(now);
  }

  rewind(ts: number) {
    this.lastTs = ts;
  }

  seedIndex(btc: number, eth: number) {
    if (btc > 0) {
      this.indices.BTC = btc;
      this.lastTrade.BTC = btc;
      const p = this.linear[PERP.BTC];
      if (p) p.avgPrice = btc;
    }
    if (eth > 0) {
      this.indices.ETH = eth;
      this.lastTrade.ETH = eth;
      const p = this.linear[PERP.ETH];
      if (p) p.avgPrice = eth;
    }
    this.seedBook(Date.now());
  }

  private registerDated(now: number) {
    for (const ccy of ["BTC", "ETH"] as Currency[]) {
      const names = [
        `${ccy}-${formatExpiry(nextFriday(now, 4))}`,
        `${ccy}-${formatExpiry(nextFriday(now, 13))}`,
      ];
      this.datedNames[ccy] = names;
      const base = SPECS[PERP[ccy]]!;
      for (const name of names) {
        SPECS[name] = { ...base, instrument: name };
        this.linear[name] = { currency: ccy, sizeUsd: 0, avgPrice: this.indices[ccy] };
      }
    }
  }

  hedgeUniverse(ccy: Currency): string[] {
    return [PERP[ccy], ...this.datedNames[ccy]];
  }

  private seedBook(now: number) {
    const btc = this.indices.BTC;
    const eth = this.indices.ETH;
    const w1 = nextFriday(now, 1);
    const w2 = nextFriday(now, 2);
    const kBtc = Math.round(btc / 500) * 500;
    const kBtc25 = Math.round((btc * 1.08) / 500) * 500;
    const kEth = Math.round(eth / 10) * 10;
    const mk = (
      ccy: Currency,
      k: number,
      exp: number,
      isCall: boolean,
      size: number,
      iv: number,
    ): PaperOption => {
      const tag = isCall ? "C" : "P";
      const instrument = `${ccy}-${formatExpiry(exp)}-${k}-${tag}`;
      const g = blackScholes({
        spot: ccy === "BTC" ? btc : eth,
        strike: k,
        tYears: Math.max(1 / 365, (exp - now) / (365 * 24 * 3600 * 1000)),
        vol: iv,
        isCall,
      });
      const premium = Math.max(0.0001, Math.abs(g.delta) * (ccy === "BTC" ? btc : eth) * 0.02);
      return { instrument, currency: ccy, strike: k, expiryMs: exp, isCall, size, iv, avgPrice: premium };
    };
    this.options = [
      mk("BTC", kBtc, w1, true, -12, 0.52),
      mk("BTC", kBtc, w1, false, -12, 0.54),
      mk("BTC", kBtc25, w2, true, 4, 0.48),
      mk("ETH", kEth, w1, true, -80, 0.62),
      mk("ETH", kEth, w1, false, -80, 0.64),
    ];
    this.linear[PERP.BTC] = { currency: "BTC", sizeUsd: 18_000, avgPrice: btc };
    this.linear[PERP.ETH] = { currency: "ETH", sizeUsd: -4_800, avgPrice: eth };
  }

  spec(instrument: string): InstrumentSpec {
    const s = SPECS[instrument];
    if (s) return s;
    const ccy = instrument.startsWith("ETH") ? "ETH" : "BTC";
    const spec = { ...SPECS[PERP[ccy]]!, instrument };
    SPECS[instrument] = spec;
    return spec;
  }

  book(instrument: string, now: number): OrderBook {
    const spec = this.spec(instrument);
    const index = this.indices[spec.currency];
    const basis = spec.currency === "BTC" ? 1.0002 : 1.00015;
    const mid = index * basis;
    const spread = Math.max(spec.tickSize * 2, mid * 0.00008);
    const bestBid = roundTick(mid - spread / 2, spec.tickSize);
    const bestAsk = roundTick(mid + spread / 2, spec.tickSize);
    return {
      instrument,
      bestBid,
      bestAsk,
      bidSize: spec.currency === "BTC" ? 120_000 : 80_000,
      askSize: spec.currency === "BTC" ? 110_000 : 75_000,
      mid: (bestBid + bestAsk) / 2,
      index,
      ts: now,
    };
  }

  advance(now: number) {
    const dt = Math.min(8, Math.max(0.2, (now - this.lastTs) / 1000));
    this.lastTs = now;
    for (const ccy of ["BTC", "ETH"] as Currency[]) {
      const vol = ccy === "BTC" ? 0.48 : 0.62;
      const z = randn(this.rng);
      const shock = Math.exp(
        -0.5 * vol * vol * (dt / (365 * 24 * 3600)) + vol * Math.sqrt(dt / (365 * 24 * 3600)) * z,
      );
      this.indices[ccy] = Math.max(1, this.indices[ccy] * shock);
      const micro = (this.rng() - 0.5) * this.indices[ccy] * 0.00025;
      this.lastTrade[ccy] = this.indices[ccy] + micro;
    }
    this.match(now);
  }

  positions(now: number): Position[] {
    const out: Position[] = [];
    for (const o of this.options) {
      const spot = this.indices[o.currency];
      const tYears = Math.max(1 / 365 / 24, (o.expiryMs - now) / (365.25 * 24 * 3600 * 1000));
      const g = blackScholes({
        spot,
        strike: o.strike,
        tYears,
        vol: o.iv,
        isCall: o.isCall,
      });
      out.push({
        instrument: o.instrument,
        currency: o.currency,
        kind: "option",
        size: o.size,
        sizeCurrency: o.size,
        delta: g.delta * o.size,
        gamma: g.gamma * o.size,
        vega: g.vega * o.size,
        theta: g.theta * o.size,
        mark: Math.max(0.0001, Math.abs(g.delta) * 0.04 * spot),
        avgPrice: o.avgPrice,
        iv: o.iv,
        strike: o.strike,
        expiryMs: o.expiryMs,
        optionType: o.isCall ? "call" : "put",
      });
    }
    for (const [instrument, p] of Object.entries(this.linear)) {
      const index = this.indices[p.currency];
      const sizeCurrency = p.sizeUsd / index;
      out.push({
        instrument,
        currency: p.currency,
        kind: "future",
        size: p.sizeUsd,
        sizeCurrency,
        delta: sizeCurrency,
        gamma: 0,
        vega: 0,
        theta: 0,
        mark: index,
        avgPrice: p.avgPrice,
      });
    }
    return out.filter((p) => Math.abs(p.size) > 1e-8);
  }

  placeMaker(args: {
    instrument: string;
    side: Side;
    price: number;
    amountUsd: number;
    now: number;
    label: string;
    rejectPostOnly: boolean;
  }): WorkingOrder {
    const book = this.book(args.instrument, args.now);
    const spec = this.spec(args.instrument);
    const amountUsd = floorTo(args.amountUsd, spec.minTradeUsd);
    if (amountUsd < spec.minTradeUsd) {
      return {
        id: `p${this.seq++}`,
        instrument: args.instrument,
        currency: spec.currency,
        side: args.side,
        price: args.price,
        amountUsd: 0,
        filledUsd: 0,
        remainingUsd: 0,
        createdAt: args.now,
        updatedAt: args.now,
        state: "rejected",
        label: args.label,
        postOnly: true,
      };
    }
    const wouldTake = args.side === "buy" ? args.price >= book.bestAsk : args.price <= book.bestBid;
    if (wouldTake && args.rejectPostOnly) {
      return {
        id: `p${this.seq++}`,
        instrument: args.instrument,
        currency: spec.currency,
        side: args.side,
        price: args.price,
        amountUsd,
        filledUsd: 0,
        remainingUsd: amountUsd,
        createdAt: args.now,
        updatedAt: args.now,
        state: "rejected",
        label: args.label,
        postOnly: true,
      };
    }
    const price = wouldTake ? (args.side === "buy" ? book.bestBid : book.bestAsk) : args.price;
    const order: WorkingOrder = {
      id: `p${this.seq++}`,
      instrument: args.instrument,
      currency: spec.currency,
      side: args.side,
      price,
      amountUsd,
      filledUsd: 0,
      remainingUsd: amountUsd,
      createdAt: args.now,
      updatedAt: args.now,
      state: "open",
      label: args.label,
      postOnly: true,
    };
    this.orders.set(order.id, order);
    return order;
  }

  cancel(id: string, now: number) {
    const o = this.orders.get(id);
    if (!o || o.state !== "open") return;
    o.state = "cancelled";
    o.updatedAt = now;
  }

  cancelKeel(now: number) {
    for (const o of this.orders.values()) {
      if (o.state === "open" && o.label.startsWith(labelPrefix())) this.cancel(o.id, now);
    }
  }

  openOrders(): WorkingOrder[] {
    return [...this.orders.values()].filter((o) => o.state === "open");
  }

  private match(now: number) {
    for (const o of this.orders.values()) {
      if (o.state !== "open") continue;
      const last = this.lastTrade[o.currency];
      const through = o.side === "buy" ? last <= o.price : last >= o.price;
      const age = (now - o.createdAt) / 1000;
      const queueHit = this.rng() < Math.min(0.55, 0.08 + age / 40);
      if (!through && !queueHit) continue;
      const chunk = floorTo(o.remainingUsd * (0.35 + this.rng() * 0.65), 1);
      const fill = Math.max(
        o.currency === "BTC" ? 10 : 1,
        Math.min(o.remainingUsd, chunk || o.remainingUsd),
      );
      o.filledUsd += fill;
      o.remainingUsd = Math.max(0, o.amountUsd - o.filledUsd);
      o.updatedAt = now;
      this.applyFill(o.instrument, o.currency, o.side, fill, o.price);
      if (o.remainingUsd <= 0) o.state = "filled";
    }
  }

  private applyFill(instrument: string, ccy: Currency, side: Side, usd: number, price: number) {
    let p = this.linear[instrument];
    if (!p) {
      p = { currency: ccy, sizeUsd: 0, avgPrice: price };
      this.linear[instrument] = p;
    }
    const signed = side === "buy" ? usd : -usd;
    const newSize = p.sizeUsd + signed;
    if (Math.abs(newSize) < 1e-6) {
      p.sizeUsd = 0;
      p.avgPrice = price;
      return;
    }
    if (p.sizeUsd === 0 || Math.sign(p.sizeUsd) === Math.sign(signed)) {
      const notional = Math.abs(p.sizeUsd) * p.avgPrice + Math.abs(signed) * price;
      p.avgPrice = notional / (Math.abs(p.sizeUsd) + Math.abs(signed));
    }
    p.sizeUsd = newSize;
  }
}

export { SPECS as PAPER_SPECS };
