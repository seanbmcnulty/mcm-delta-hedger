import { createHmac, randomBytes } from "node:crypto";
import type { Currency, InstrumentSpec, Kind, OrderBook, Position, Side, Venue, WorkingOrder } from "@/lib/hedge/types";
import { parseOptionInstrument } from "@/lib/hedge/math";
import { redact } from "@/lib/hedge/redact";

type RpcError = { code: number; message: string; data?: unknown };

export class DeribitError extends Error {
  code: number;
  constructor(err: RpcError) {
    super(redact(err.message));
    this.code = err.code;
  }
}

function hostFor(venue: Exclude<Venue, "paper">) {
  return venue === "testnet" ? "https://test.deribit.com" : "https://www.deribit.com";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(err: unknown) {
  if (err instanceof DeribitError) {
    if (err.code === 10028 || err.code === 10040) return true;
    if (err.code >= 13000 && err.code < 14000) return false;
    return false;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /timeout|network|fetch|ECONN|503|429|502|abortex/i.test(msg);
}

function isAuthError(err: unknown) {
  if (err instanceof DeribitError) return err.code === 13004 || err.code === 13009 || err.code === 13010 || err.code === 10003;
  const msg = err instanceof Error ? err.message : String(err);
  return /token|unauthorized|invalid credentials|auth/i.test(msg);
}

async function readRpc(res: Response) {
  const json = (await res.json()) as { result?: unknown; error?: RpcError };
  if (json.error) throw new DeribitError(json.error);
  return json.result;
}

async function publicGet(
  base: string,
  method: string,
  params: Record<string, string | number>,
  signal?: AbortSignal,
) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) q.set(k, String(v));
  const url = `${base}/api/v2/${method}?${q.toString()}`;
  const res = await fetch(url, { headers: { accept: "application/json" }, signal });
  if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
  return readRpc(res);
}

async function publicPost(
  base: string,
  method: string,
  params: Record<string, string | number>,
  signal?: AbortSignal,
) {
  const res = await fetch(`${base}/api/v2/`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal,
  });
  if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
  return readRpc(res);
}

async function publicCall(
  base: string,
  method: string,
  params: Record<string, string | number>,
  timeoutMs = 2500,
) {
  try {
    return await publicGet(base, method, params, AbortSignal.timeout(timeoutMs));
  } catch {
    return await publicPost(base, method, params, AbortSignal.timeout(timeoutMs));
  }
}

async function indexPair(base: string) {
  const [btc, eth] = await Promise.all([
    publicCall(base, "public/get_index_price", { index_name: "btc_usd" }),
    publicCall(base, "public/get_index_price", { index_name: "eth_usd" }),
  ]);
  return {
    BTC: Number((btc as { index_price: number }).index_price),
    ETH: Number((eth as { index_price: number }).index_price),
  };
}

async function indexFromTickers(base: string) {
  const [btc, eth] = await Promise.all([
    publicCall(base, "public/ticker", { instrument_name: "BTC-PERPETUAL" }),
    publicCall(base, "public/ticker", { instrument_name: "ETH-PERPETUAL" }),
  ]);
  return {
    BTC: Number((btc as { index_price: number }).index_price),
    ETH: Number((eth as { index_price: number }).index_price),
  };
}

export async function fetchPublicIndex(): Promise<{
  BTC: number;
  ETH: number;
  source: "primary" | "fallback" | "ticker";
}> {
  const primary = "https://www.deribit.com";
  try {
    const idx = await indexPair(primary);
    if (idx.BTC > 0 && idx.ETH > 0) return { ...idx, source: "primary" };
  } catch {
    /* next source */
  }
  try {
    const idx = await indexPair(primary);
    if (idx.BTC > 0 && idx.ETH > 0) return { ...idx, source: "fallback" };
  } catch {
    /* ticker */
  }
  const idx = await indexFromTickers(primary);
  if (!(idx.BTC > 0 && idx.ETH > 0)) throw new Error("All public index sources failed.");
  return { ...idx, source: "ticker" };
}

export class DeribitClient {
  readonly venue: Exclude<Venue, "paper">;
  readonly clientId: string;
  private readonly secret: string;
  private token: string | null = null;
  private tokenExp = 0;
  private id = 1;
  private readonly base: string;

  constructor(venue: Exclude<Venue, "paper">, clientId: string, secret: string) {
    this.venue = venue;
    this.clientId = clientId;
    this.secret = secret;
    this.base = hostFor(venue);
  }

  maskedId() {
    const id = this.clientId;
    if (id.length <= 8) return "••••";
    return `${id.slice(0, 4)}…${id.slice(-4)}`;
  }

  async authenticate() {
    const result = (await this.rpc(
      "public/auth",
      {
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.secret,
      },
      false,
    )) as { access_token: string; expires_in: number };
    this.token = result.access_token;
    this.tokenExp = Date.now() + Math.max(30_000, (result.expires_in - 60) * 1000);
    return true;
  }

  private async ensureToken() {
    if (this.token && Date.now() < this.tokenExp) return;
    await this.authenticate();
  }

  async rpc(method: string, params: Record<string, unknown> = {}, auth = true) {
    let last: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (auth) await this.ensureToken();
        return await this.rpcOnce(method, params, auth);
      } catch (err) {
        last = err;
        if (isAuthError(err) && attempt === 0) {
          this.token = null;
          if (auth) {
            try {
              await this.authenticate();
              continue;
            } catch {
              /* fall through to HMAC once */
            }
          }
        }
        if (!isRetryable(err) || attempt === 2) throw err instanceof Error ? err : new Error(redact(err));
        await sleep(200 * 2 ** attempt);
      }
    }
    throw last instanceof Error ? last : new Error(redact(last));
  }

  private async rpcOnce(method: string, params: Record<string, unknown>, auth: boolean) {
    const payload = { jsonrpc: "2.0", id: this.id++, method, params };
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
    if (auth && this.token) headers.authorization = `Bearer ${this.token}`;
    else if (auth) headers.authorization = this.hmacHeader("POST", "/api/v2/", body);

    const res = await fetch(`${this.base}/api/v2/`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401 || res.status === 403) {
      throw new DeribitError({ code: 13009, message: `HTTP ${res.status}` });
    }
    if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
    return readRpc(res);
  }

  private hmacHeader(httpMethod: string, uri: string, body: string) {
    const ts = String(Date.now());
    const nonce = randomBytes(8).toString("hex");
    const method = httpMethod.toUpperCase();
    const requestData = `${method}\n${uri}\n${body}\n`;
    const toSign = `${ts}\n${nonce}\n${requestData}`;
    const sig = createHmac("sha256", this.secret).update(toSign).digest("hex");
    return `deri-hmac-sha256 id=${this.clientId},ts=${ts},sig=${sig},nonce=${nonce}`;
  }

  wipe() {
    this.token = null;
    this.tokenExp = 0;
  }

  async getIndex(ccy: Currency) {
    const name = ccy === "BTC" ? "btc_usd" : "eth_usd";
    try {
      const r = (await this.rpc("public/get_index_price", { index_name: name }, false)) as {
        index_price: number;
      };
      return r.index_price;
    } catch {
      const inst = ccy === "BTC" ? "BTC-PERPETUAL" : "ETH-PERPETUAL";
      const r = (await this.rpc("public/ticker", { instrument_name: inst }, false)) as { index_price: number };
      return r.index_price;
    }
  }

  async getBook(instrument: string, depth = 5): Promise<OrderBook> {
    const r = (await this.rpc(
      "public/get_order_book",
      { instrument_name: instrument, depth },
      false,
    )) as {
      best_bid_price: number;
      best_ask_price: number;
      best_bid_amount: number;
      best_ask_amount: number;
      index_price: number;
      timestamp: number;
    };
    const bestBid = r.best_bid_price;
    const bestAsk = r.best_ask_price;
    return {
      instrument,
      bestBid,
      bestAsk,
      bidSize: r.best_bid_amount,
      askSize: r.best_ask_amount,
      mid: (bestBid + bestAsk) / 2,
      index: r.index_price,
      ts: r.timestamp,
    };
  }

  async getInstrument(instrument: string): Promise<InstrumentSpec> {
    const r = (await this.rpc("public/get_instrument", { instrument_name: instrument }, false)) as {
      instrument_name: string;
      base_currency: string;
      tick_size: number;
      min_trade_amount: number;
      contract_size: number;
    };
    return {
      instrument: r.instrument_name,
      currency: r.base_currency as Currency,
      tickSize: r.tick_size,
      minTradeUsd: r.min_trade_amount,
      contractSize: r.contract_size,
    };
  }

  async getPositions(currency: Currency): Promise<Position[]> {
    const kinds: Kind[] = ["future", "option", "future_combo", "option_combo"];
    const batches = await Promise.all(
      kinds.map(async (kind) => {
        try {
          return (await this.rpc("private/get_positions", { currency, kind })) as Array<{
            instrument_name: string;
            kind: Kind;
            size: number;
            size_currency?: number;
            delta: number;
            gamma?: number;
            vega?: number;
            theta?: number;
            mark_price: number;
            average_price: number;
            mark_iv?: number;
          }>;
        } catch {
          return [];
        }
      }),
    );
    const rows = batches.flat();
    return rows
      .filter((r) => Math.abs(r.size) > 0)
      .map((r) => {
        const parsed = parseOptionInstrument(r.instrument_name);
        return {
          instrument: r.instrument_name,
          currency,
          kind: r.kind,
          size: r.size,
          sizeCurrency: r.size_currency ?? r.size,
          delta: r.delta,
          gamma: r.gamma ?? 0,
          vega: r.vega ?? 0,
          theta: r.theta ?? 0,
          mark: r.mark_price,
          avgPrice: r.average_price,
          iv: r.mark_iv,
          strike: parsed.strike ?? undefined,
          expiryMs: parsed.expiryMs ?? undefined,
          optionType: parsed.optionType ?? undefined,
        } satisfies Position;
      });
  }

  async getAccount(currency: Currency) {
    const r = (await this.rpc("private/get_account_summary", { currency, extended: true })) as {
      equity: number;
      initial_margin: number;
      available_funds: number;
      delta_total: number;
    };
    return {
      equity: r.equity,
      margin: r.initial_margin,
      available: r.available_funds,
      deltaTotal: r.delta_total,
    };
  }

  async getOpenOrders(currency: Currency): Promise<WorkingOrder[]> {
    const rows = (await this.rpc("private/get_open_orders_by_currency", { currency })) as Array<{
      order_id: string;
      instrument_name: string;
      direction: Side;
      price: number;
      amount: number;
      filled_amount: number;
      creation_timestamp: number;
      last_update_timestamp: number;
      order_state: string;
      label: string;
      post_only: boolean;
    }>;
    return rows.map((r) => ({
      id: r.order_id,
      instrument: r.instrument_name,
      currency,
      side: r.direction,
      price: Number(r.price),
      amountUsd: r.amount,
      filledUsd: r.filled_amount,
      remainingUsd: r.amount - r.filled_amount,
      createdAt: r.creation_timestamp,
      updatedAt: r.last_update_timestamp,
      state: r.order_state === "open" || r.order_state === "untriggered" ? "open" : "cancelled",
      label: r.label || "",
      postOnly: true,
    }));
  }

  async buySell(args: {
    side: Side;
    instrument: string;
    amount: number;
    price: number;
    label: string;
    rejectPostOnly: boolean;
  }) {
    const method = args.side === "buy" ? "private/buy" : "private/sell";
    const r = (await this.rpc(method, {
      instrument_name: args.instrument,
      amount: args.amount,
      type: "limit",
      price: args.price,
      post_only: true,
      reject_post_only: args.rejectPostOnly,
      time_in_force: "good_til_cancelled",
      label: args.label,
    })) as { order: { order_id: string; order_state: string; price: number; amount: number; filled_amount: number; label: string } };
    return r.order;
  }

  async edit(orderId: string, amount: number, price: number, rejectPostOnly: boolean) {
    return this.rpc("private/edit", {
      order_id: orderId,
      amount,
      price,
      post_only: true,
      reject_post_only: rejectPostOnly,
    });
  }

  async cancel(orderId: string) {
    return this.rpc("private/cancel", { order_id: orderId });
  }

  async cancelByLabel(label: string, currency?: Currency) {
    const params: Record<string, unknown> = { label };
    if (currency) params.currency = currency;
    return this.rpc("private/cancel_by_label", params);
  }
}
