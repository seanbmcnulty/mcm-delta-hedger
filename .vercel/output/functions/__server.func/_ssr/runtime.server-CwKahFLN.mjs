import { r as getSql } from "./db-D1iZvg5m.mjs";
import { A as parseOptionInstrument, C as isKeelLabel, D as mean, E as makerPrice, F as snapInterval, I as splitNotional, L as sumGreeks, M as rms, N as roundTick, O as minRvForLookback, P as secFromFreq, S as includedPositions, T as makeLabel, _ as emptySurface, b as freqFromSec, c as buildSurface, d as clamp, f as ddhCurrent, g as deviationDelta, h as ddhThresholds, j as randn, k as mulberry32, l as captureBps, m as ddhHedgeUsd, n as CURRENCIES, o as PERP, p as ddhFire, r as DEFAULT_CONFIG, s as blackScholes, v as floorTo, w as labelPrefix, x as hedgeInstrument } from "./rv-Buo_bNNw.mjs";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "node:crypto";
//#region node_modules/.nitro/vite/services/ssr/assets/runtime.server-CwKahFLN.js
function qualityFromCycles(cycles) {
	const done = cycles.filter((c) => c.endedAt);
	const n = done.length;
	if (!n) return {
		score: 0,
		fill: 0,
		capture: 0,
		residual: 0,
		adverse: 0,
		n: 0
	};
	const fill = mean(done.map((c) => c.fillRate));
	const captures = done.map((c) => c.captureBps).filter((x) => x !== null);
	const adverses = done.map((c) => c.adverseBps).filter((x) => x !== null);
	const capture = captures.length ? mean(captures) : 0;
	const adverse = adverses.length ? mean(adverses) : 0;
	const residual = mean(done.map((c) => Math.abs(c.endDelta ?? c.startDelta)));
	const fillScore = clamp(fill, 0, 1);
	const captureScore = clamp(.5 + capture / 6, 0, 1);
	const residualScore = clamp(1 - residual / .4, 0, 1);
	const adverseScore = clamp(1 - Math.max(0, adverse) / 8, 0, 1);
	return {
		score: 100 * (.28 * fillScore + .22 * captureScore + .28 * residualScore + .22 * adverseScore),
		fill,
		capture,
		residual,
		adverse,
		n
	};
}
function suggestionsFrom(args) {
	const { quality: q, config, gamma } = args;
	const out = [];
	if (q.n < 4) {
		out.push("Need a handful of completed cycles before the tuner can speak with any confidence.");
		return out;
	}
	if (q.fill < .4) out.push(`Maker fill rate is ${(q.fill * 100).toFixed(0)}%. Tighten quoteOffsetTicks (currently ${config.quoteOffsetTicks}) or lengthen the cycle so quotes rest longer.`);
	else if (q.fill > .88 && q.adverse > 1.2) out.push(`Fills are fast but adverse selection is ${q.adverse.toFixed(2)} bp. Step back a tick — you are being sniped at the touch.`);
	if (q.capture < -.4) out.push(`Average capture ${q.capture.toFixed(2)} bp is negative — fills are through the mid. Stay post-only and do not chase.`);
	else if (q.capture > .6) out.push(`Earning ${q.capture.toFixed(2)} bp vs mid. Passive quoting is paying for itself.`);
	const gBtc = Math.abs(gamma.BTC);
	const gEth = Math.abs(gamma.ETH);
	const impliedMin = gBtc > 4e-4 || gEth > .008 ? 20 : 45;
	if (config.intervalSec > impliedMin * 1.6 && (gBtc > 3e-4 || gEth > .005)) out.push(`Short gamma is material (BTC γ ${gamma.BTC.toFixed(5)}, ETH γ ${gamma.ETH.toFixed(4)}). A ${config.intervalSec}s cycle leaves delta to run — try ~${impliedMin}s.`);
	if (q.residual > .15) out.push("Residual after clocks is still large. Shorten the interval or raise hedge %.");
	if (q.n >= 8 && q.score > 78 && config.intervalSec < 90 && gBtc < 2e-4) out.push("Quiet book and high score — you can lengthen the interval and save on turnover.");
	if (!out.length) out.push("Policy looks balanced. Leave auto-tune on and re-evaluate after another hour.");
	return out.slice(0, 4);
}
function autoTune(config, quality, gamma, now) {
	if (!config.autoTune || quality.n < 6) return {
		config,
		changes: []
	};
	const next = {
		...config,
		threshold: { ...config.threshold },
		thresholdPos: { ...config.thresholdPos },
		thresholdNeg: { ...config.thresholdNeg },
		maxHedgeUsd: { ...config.maxHedgeUsd },
		targetDelta: { ...config.targetDelta },
		currencies: [...config.currencies],
		hedgeSkip: [...config.hedgeSkip ?? []],
		longInstrument: { ...config.longInstrument },
		shortInstrument: { ...config.shortInstrument },
		orderAmountCoin: { ...config.orderAmountCoin }
	};
	const changes = [];
	const bump = (field, from, to, reason, apply) => {
		if (from === to) return;
		apply();
		changes.push({
			t: now,
			field,
			from,
			to,
			reason
		});
	};
	if (quality.fill < .38 && next.quoteOffsetTicks > -2) {
		const from = next.quoteOffsetTicks;
		bump("quoteOffsetTicks", from, from - 1, "Low maker fill rate — tightening quotes", () => {
			next.quoteOffsetTicks = from - 1;
		});
	} else if (quality.fill > .86 && quality.adverse > 1.4 && next.quoteOffsetTicks < 3) {
		const from = next.quoteOffsetTicks;
		bump("quoteOffsetTicks", from, from + 1, "Adverse selection after quick fills — stepping back a tick", () => {
			next.quoteOffsetTicks = from + 1;
		});
	}
	const hotGamma = Math.abs(gamma.BTC) > 35e-5 || Math.abs(gamma.ETH) > .007;
	if (config.freqPolicy !== "min_rv") {
		if (quality.residual > .08 && hotGamma && next.intervalSec > 60) {
			const from = next.intervalSec;
			const to = Math.max(60, Math.round(from * .75));
			bump("intervalSec", from, to, "Residual delta too large versus gamma — shortening cycle", () => {
				next.intervalSec = to;
			});
		} else if (quality.residual < .012 && !hotGamma && next.intervalSec < 3600) {
			const from = next.intervalSec;
			const to = Math.min(86400, Math.round(from * 1.15));
			bump("intervalSec", from, to, "Quiet residual — lengthening cycle to cut turnover", () => {
				next.intervalSec = to;
			});
		}
	}
	return {
		config: next,
		changes
	};
}
function counterfactuals(series) {
	if (series.length < 8) return [];
	const intervals = [
		15,
		30,
		60,
		120,
		300
	];
	const out = [];
	for (const intervalSec of intervals) {
		let lastHedgeT = series[0].t;
		let btcPerp = 0;
		let ethPerp = 0;
		let cost = 0;
		let nHedges = 0;
		const residuals = [];
		const spreadBps = .8;
		for (const p of series) {
			const optBtc = p.btcDelta - btcPerp;
			const optEth = p.ethDelta - ethPerp;
			if (p.t - lastHedgeT >= intervalSec * 1e3) {
				const halfBtc = p.btcIndex * (spreadBps / 1e4) * .5;
				const halfEth = p.ethIndex * (spreadBps / 1e4) * .5;
				cost += Math.abs(optBtc) * halfBtc + Math.abs(optEth) * halfEth;
				btcPerp += -optBtc;
				ethPerp += -optEth;
				nHedges += 1;
				lastHedgeT = p.t;
			}
			residuals.push(Math.abs(optBtc) + Math.abs(optEth) * .05);
		}
		out.push({
			intervalSec,
			estCostUsd: cost,
			residualRms: rms(residuals),
			nHedges
		});
	}
	return out;
}
function restoreConfig() {
	return {
		...DEFAULT_CONFIG,
		threshold: { ...DEFAULT_CONFIG.threshold },
		thresholdPos: { ...DEFAULT_CONFIG.thresholdPos },
		thresholdNeg: { ...DEFAULT_CONFIG.thresholdNeg },
		maxHedgeUsd: { ...DEFAULT_CONFIG.maxHedgeUsd },
		targetDelta: { ...DEFAULT_CONFIG.targetDelta },
		currencies: [...DEFAULT_CONFIG.currencies],
		hedgeSkip: [...DEFAULT_CONFIG.hedgeSkip],
		longInstrument: { ...DEFAULT_CONFIG.longInstrument },
		shortInstrument: { ...DEFAULT_CONFIG.shortInstrument },
		orderAmountCoin: { ...DEFAULT_CONFIG.orderAmountCoin }
	};
}
function coachPrompt(payload) {
	const recent = payload.cycles.slice(-12).map((c) => ({
		ccy: c.currency,
		start: Number(c.startDelta.toFixed(4)),
		end: c.endDelta === null ? null : Number(c.endDelta.toFixed(4)),
		fillRate: Number(c.fillRate.toFixed(2)),
		captureBps: c.captureBps === null ? null : Number(c.captureBps.toFixed(2)),
		adverseBps: c.adverseBps === null ? null : Number(c.adverseBps.toFixed(2)),
		filledUsd: Math.round(c.filledUsd)
	}));
	return `You are a crypto options MM coach reviewing a maker-only portfolio delta hedge on Deribit (BTC & ETH perps, post-only).
Be terse, numeric, and opinionated. No fluff. 3-6 short bullets plus one recommended next change.

Config: ${JSON.stringify(payload.config)}
Quality: ${JSON.stringify(payload.quality)}
Gamma: ${JSON.stringify(payload.gamma)}
Heuristic notes: ${JSON.stringify(payload.suggestions)}
Interval counterfactuals (half-spread cost vs residual): ${JSON.stringify(payload.counterfactuals)}
Recent cycles: ${JSON.stringify(recent)}`;
}
var SECRETISH = /(?:client_secret|client_id|access_token|refresh_token|authorization)\s*[:=]\s*[^\s"'&,}]+/gi;
function redact(input) {
	return (input instanceof Error ? input.message : String(input ?? "")).replace(SECRETISH, (m) => `${m.split(/[:=]/)[0]}=***`).replace(/Bearer\s+\S+/gi, "Bearer ***").replace(/\bsig=[a-f0-9]+/gi, "sig=***").replace(/https:\/\/[^\s"'<>]+(?:hooks|webhook)[^\s"'<>]*/gi, "https://••••");
}
function maskUrl(url) {
	try {
		const u = new URL(url);
		return `${u.protocol}//${u.host}/••••`;
	} catch {
		return "••••";
	}
}
var DeribitError = class extends Error {
	code;
	constructor(err) {
		super(redact(err.message));
		this.code = err.code;
	}
};
function hostFor(venue) {
	return venue === "testnet" ? "https://test.deribit.com" : "https://www.deribit.com";
}
function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}
function isRetryable(err) {
	if (err instanceof DeribitError) {
		if (err.code === 10028 || err.code === 10040) return true;
		if (err.code >= 13e3 && err.code < 14e3) return false;
		return false;
	}
	const msg = err instanceof Error ? err.message : String(err);
	return /timeout|network|fetch|ECONN|503|429|502|abortex/i.test(msg);
}
function isAuthError(err) {
	if (err instanceof DeribitError) return err.code === 13004 || err.code === 13009 || err.code === 13010 || err.code === 10003;
	const msg = err instanceof Error ? err.message : String(err);
	return /token|unauthorized|invalid credentials|auth/i.test(msg);
}
async function readRpc(res) {
	const json = await res.json();
	if (json.error) throw new DeribitError(json.error);
	return json.result;
}
async function publicGet(base, method, params, signal) {
	const q = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) q.set(k, String(v));
	const url = `${base}/api/v2/${method}?${q.toString()}`;
	const res = await fetch(url, {
		headers: { accept: "application/json" },
		signal
	});
	if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
	return readRpc(res);
}
async function publicPost(base, method, params, signal) {
	const res = await fetch(`${base}/api/v2/`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json"
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method,
			params
		}),
		signal
	});
	if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
	return readRpc(res);
}
async function publicCall(base, method, params, timeoutMs = 2500) {
	try {
		return await publicGet(base, method, params, AbortSignal.timeout(timeoutMs));
	} catch {
		return await publicPost(base, method, params, AbortSignal.timeout(timeoutMs));
	}
}
async function indexPair(base) {
	const [btc, eth] = await Promise.all([publicCall(base, "public/get_index_price", { index_name: "btc_usd" }), publicCall(base, "public/get_index_price", { index_name: "eth_usd" })]);
	return {
		BTC: Number(btc.index_price),
		ETH: Number(eth.index_price)
	};
}
async function indexFromTickers(base) {
	const [btc, eth] = await Promise.all([publicCall(base, "public/ticker", { instrument_name: "BTC-PERPETUAL" }), publicCall(base, "public/ticker", { instrument_name: "ETH-PERPETUAL" })]);
	return {
		BTC: Number(btc.index_price),
		ETH: Number(eth.index_price)
	};
}
async function fetchPublicIndex() {
	const primary = "https://www.deribit.com";
	try {
		const idx = await indexPair(primary);
		if (idx.BTC > 0 && idx.ETH > 0) return {
			...idx,
			source: "primary"
		};
	} catch {}
	try {
		const idx = await indexPair(primary);
		if (idx.BTC > 0 && idx.ETH > 0) return {
			...idx,
			source: "fallback"
		};
	} catch {}
	const idx = await indexFromTickers(primary);
	if (!(idx.BTC > 0 && idx.ETH > 0)) throw new Error("All public index sources failed.");
	return {
		...idx,
		source: "ticker"
	};
}
var DeribitClient = class {
	venue;
	clientId;
	secret;
	token = null;
	tokenExp = 0;
	id = 1;
	base;
	constructor(venue, clientId, secret) {
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
		const result = await this.rpc("public/auth", {
			grant_type: "client_credentials",
			client_id: this.clientId,
			client_secret: this.secret
		}, false);
		this.token = result.access_token;
		this.tokenExp = Date.now() + Math.max(3e4, (result.expires_in - 60) * 1e3);
		return true;
	}
	async ensureToken() {
		if (this.token && Date.now() < this.tokenExp) return;
		await this.authenticate();
	}
	async rpc(method, params = {}, auth = true) {
		let last;
		for (let attempt = 0; attempt < 3; attempt++) try {
			if (auth) await this.ensureToken();
			return await this.rpcOnce(method, params, auth);
		} catch (err) {
			last = err;
			if (isAuthError(err) && attempt === 0) {
				this.token = null;
				if (auth) try {
					await this.authenticate();
					continue;
				} catch {}
			}
			if (!isRetryable(err) || attempt === 2) throw err instanceof Error ? err : new Error(redact(err));
			await sleep(200 * 2 ** attempt);
		}
		throw last instanceof Error ? last : new Error(redact(last));
	}
	async rpcOnce(method, params, auth) {
		const payload = {
			jsonrpc: "2.0",
			id: this.id++,
			method,
			params
		};
		const body = JSON.stringify(payload);
		const headers = {
			"content-type": "application/json",
			accept: "application/json"
		};
		if (auth && this.token) headers.authorization = `Bearer ${this.token}`;
		else if (auth) headers.authorization = this.hmacHeader("POST", "/api/v2/", body);
		const res = await fetch(`${this.base}/api/v2/`, {
			method: "POST",
			headers,
			body,
			signal: AbortSignal.timeout(5e3)
		});
		if (res.status === 401 || res.status === 403) throw new DeribitError({
			code: 13009,
			message: `HTTP ${res.status}`
		});
		if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
		return readRpc(res);
	}
	hmacHeader(httpMethod, uri, body) {
		const ts = String(Date.now());
		const nonce = randomBytes(8).toString("hex");
		const toSign = `${ts}\n${nonce}\n${`${httpMethod.toUpperCase()}\n${uri}\n${body}\n`}`;
		const sig = createHmac("sha256", this.secret).update(toSign).digest("hex");
		return `deri-hmac-sha256 id=${this.clientId},ts=${ts},sig=${sig},nonce=${nonce}`;
	}
	wipe() {
		this.token = null;
		this.tokenExp = 0;
	}
	async getIndex(ccy) {
		const name = ccy === "BTC" ? "btc_usd" : "eth_usd";
		try {
			return (await this.rpc("public/get_index_price", { index_name: name }, false)).index_price;
		} catch {
			const inst = ccy === "BTC" ? "BTC-PERPETUAL" : "ETH-PERPETUAL";
			return (await this.rpc("public/ticker", { instrument_name: inst }, false)).index_price;
		}
	}
	async getBook(instrument, depth = 5) {
		const r = await this.rpc("public/get_order_book", {
			instrument_name: instrument,
			depth
		}, false);
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
			ts: r.timestamp
		};
	}
	async getInstrument(instrument) {
		const r = await this.rpc("public/get_instrument", { instrument_name: instrument }, false);
		return {
			instrument: r.instrument_name,
			currency: r.base_currency,
			tickSize: r.tick_size,
			minTradeUsd: r.min_trade_amount,
			contractSize: r.contract_size
		};
	}
	async getPositions(currency) {
		return (await Promise.all([
			"future",
			"option",
			"future_combo",
			"option_combo"
		].map(async (kind) => {
			try {
				return await this.rpc("private/get_positions", {
					currency,
					kind
				});
			} catch {
				return [];
			}
		}))).flat().filter((r) => Math.abs(r.size) > 0).map((r) => {
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
				strike: parsed.strike ?? void 0,
				expiryMs: parsed.expiryMs ?? void 0,
				optionType: parsed.optionType ?? void 0
			};
		});
	}
	async getAccount(currency) {
		const r = await this.rpc("private/get_account_summary", {
			currency,
			extended: true
		});
		return {
			equity: r.equity,
			margin: r.initial_margin,
			available: r.available_funds,
			deltaTotal: r.delta_total
		};
	}
	async getOpenOrders(currency) {
		return (await this.rpc("private/get_open_orders_by_currency", { currency })).map((r) => ({
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
			postOnly: true
		}));
	}
	async buySell(args) {
		const method = args.side === "buy" ? "private/buy" : "private/sell";
		return (await this.rpc(method, {
			instrument_name: args.instrument,
			amount: args.amount,
			type: "limit",
			price: args.price,
			post_only: true,
			reject_post_only: args.rejectPostOnly,
			time_in_force: "good_til_cancelled",
			label: args.label
		})).order;
	}
	async edit(orderId, amount, price, rejectPostOnly) {
		return this.rpc("private/edit", {
			order_id: orderId,
			amount,
			price,
			post_only: true,
			reject_post_only: rejectPostOnly
		});
	}
	async cancel(orderId) {
		return this.rpc("private/cancel", { order_id: orderId });
	}
	async cancelByLabel(label, currency) {
		const params = { label };
		if (currency) params.currency = currency;
		return this.rpc("private/cancel_by_label", params);
	}
};
var SPECS = {
	"BTC-PERPETUAL": {
		instrument: "BTC-PERPETUAL",
		currency: "BTC",
		tickSize: .5,
		minTradeUsd: 10,
		contractSize: 10
	},
	"ETH-PERPETUAL": {
		instrument: "ETH-PERPETUAL",
		currency: "ETH",
		tickSize: .05,
		minTradeUsd: 1,
		contractSize: 1
	}
};
function formatExpiry(ms) {
	const d = new Date(ms);
	return `${d.getUTCDate()}${[
		"JAN",
		"FEB",
		"MAR",
		"APR",
		"MAY",
		"JUN",
		"JUL",
		"AUG",
		"SEP",
		"OCT",
		"NOV",
		"DEC"
	][d.getUTCMonth()]}${String(d.getUTCFullYear()).slice(-2)}`;
}
function nextFriday(from, weeksAhead) {
	const d = new Date(from);
	let add = (5 - d.getUTCDay() + 7) % 7;
	if (add === 0) add = 7;
	add += 7 * Math.max(0, weeksAhead - 1);
	d.setUTCDate(d.getUTCDate() + add);
	d.setUTCHours(8, 0, 0, 0);
	return d.getTime();
}
var PaperWorld = class {
	indices = {
		BTC: 64200,
		ETH: 2460
	};
	options = [];
	linear = {
		"BTC-PERPETUAL": {
			currency: "BTC",
			sizeUsd: 0,
			avgPrice: 64200
		},
		"ETH-PERPETUAL": {
			currency: "ETH",
			sizeUsd: 0,
			avgPrice: 2460
		}
	};
	orders = /* @__PURE__ */ new Map();
	seq = 1;
	rng = mulberry32(1801807212);
	lastTrade = {
		BTC: 64200,
		ETH: 2460
	};
	lastTs;
	datedNames = {
		BTC: [],
		ETH: []
	};
	constructor(now) {
		this.lastTs = now;
		this.registerDated(now);
		this.seedBook(now);
	}
	rewind(ts) {
		this.lastTs = ts;
	}
	seedIndex(btc, eth) {
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
	registerDated(now) {
		for (const ccy of ["BTC", "ETH"]) {
			const names = [`${ccy}-${formatExpiry(nextFriday(now, 4))}`, `${ccy}-${formatExpiry(nextFriday(now, 13))}`];
			this.datedNames[ccy] = names;
			const base = SPECS[PERP[ccy]];
			for (const name of names) {
				SPECS[name] = {
					...base,
					instrument: name
				};
				this.linear[name] = {
					currency: ccy,
					sizeUsd: 0,
					avgPrice: this.indices[ccy]
				};
			}
		}
	}
	hedgeUniverse(ccy) {
		return [PERP[ccy], ...this.datedNames[ccy]];
	}
	seedBook(now) {
		const btc = this.indices.BTC;
		const eth = this.indices.ETH;
		const w1 = nextFriday(now, 1);
		const w2 = nextFriday(now, 2);
		const kBtc = Math.round(btc / 500) * 500;
		const kBtc25 = Math.round(btc * 1.08 / 500) * 500;
		const kEth = Math.round(eth / 10) * 10;
		const mk = (ccy, k, exp, isCall, size, iv) => {
			const tag = isCall ? "C" : "P";
			const instrument = `${ccy}-${formatExpiry(exp)}-${k}-${tag}`;
			const g = blackScholes({
				spot: ccy === "BTC" ? btc : eth,
				strike: k,
				tYears: Math.max(1 / 365, (exp - now) / 31536e6),
				vol: iv,
				isCall
			});
			return {
				instrument,
				currency: ccy,
				strike: k,
				expiryMs: exp,
				isCall,
				size,
				iv,
				avgPrice: Math.max(1e-4, Math.abs(g.delta) * (ccy === "BTC" ? btc : eth) * .02)
			};
		};
		this.options = [
			mk("BTC", kBtc, w1, true, -12, .52),
			mk("BTC", kBtc, w1, false, -12, .54),
			mk("BTC", kBtc25, w2, true, 4, .48),
			mk("ETH", kEth, w1, true, -80, .62),
			mk("ETH", kEth, w1, false, -80, .64)
		];
		this.linear[PERP.BTC] = {
			currency: "BTC",
			sizeUsd: 18e3,
			avgPrice: btc
		};
		this.linear[PERP.ETH] = {
			currency: "ETH",
			sizeUsd: -4800,
			avgPrice: eth
		};
	}
	spec(instrument) {
		const s = SPECS[instrument];
		if (s) return s;
		const ccy = instrument.startsWith("ETH") ? "ETH" : "BTC";
		const spec = {
			...SPECS[PERP[ccy]],
			instrument
		};
		SPECS[instrument] = spec;
		return spec;
	}
	book(instrument, now) {
		const spec = this.spec(instrument);
		const index = this.indices[spec.currency];
		const mid = index * (spec.currency === "BTC" ? 1.0002 : 1.00015);
		const spread = Math.max(spec.tickSize * 2, mid * 8e-5);
		const bestBid = roundTick(mid - spread / 2, spec.tickSize);
		const bestAsk = roundTick(mid + spread / 2, spec.tickSize);
		return {
			instrument,
			bestBid,
			bestAsk,
			bidSize: spec.currency === "BTC" ? 12e4 : 8e4,
			askSize: spec.currency === "BTC" ? 11e4 : 75e3,
			mid: (bestBid + bestAsk) / 2,
			index,
			ts: now
		};
	}
	advance(now) {
		const dt = Math.min(8, Math.max(.2, (now - this.lastTs) / 1e3));
		this.lastTs = now;
		for (const ccy of ["BTC", "ETH"]) {
			const vol = ccy === "BTC" ? .48 : .62;
			const z = randn(this.rng);
			const shock = Math.exp(-.5 * vol * vol * (dt / 31536e3) + vol * Math.sqrt(dt / 31536e3) * z);
			this.indices[ccy] = Math.max(1, this.indices[ccy] * shock);
			const micro = (this.rng() - .5) * this.indices[ccy] * 25e-5;
			this.lastTrade[ccy] = this.indices[ccy] + micro;
		}
		this.match(now);
	}
	positions(now) {
		const out = [];
		for (const o of this.options) {
			const spot = this.indices[o.currency];
			const tYears = Math.max(1 / 365 / 24, (o.expiryMs - now) / 315576e5);
			const g = blackScholes({
				spot,
				strike: o.strike,
				tYears,
				vol: o.iv,
				isCall: o.isCall
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
				mark: Math.max(1e-4, Math.abs(g.delta) * .04 * spot),
				avgPrice: o.avgPrice,
				iv: o.iv,
				strike: o.strike,
				expiryMs: o.expiryMs,
				optionType: o.isCall ? "call" : "put"
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
				avgPrice: p.avgPrice
			});
		}
		return out.filter((p) => Math.abs(p.size) > 1e-8);
	}
	placeMaker(args) {
		const book = this.book(args.instrument, args.now);
		const spec = this.spec(args.instrument);
		const amountUsd = floorTo(args.amountUsd, spec.minTradeUsd);
		if (amountUsd < spec.minTradeUsd) return {
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
			postOnly: true
		};
		const wouldTake = args.side === "buy" ? args.price >= book.bestAsk : args.price <= book.bestBid;
		if (wouldTake && args.rejectPostOnly) return {
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
			postOnly: true
		};
		const price = wouldTake ? args.side === "buy" ? book.bestBid : book.bestAsk : args.price;
		const order = {
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
			postOnly: true
		};
		this.orders.set(order.id, order);
		return order;
	}
	cancel(id, now) {
		const o = this.orders.get(id);
		if (!o || o.state !== "open") return;
		o.state = "cancelled";
		o.updatedAt = now;
	}
	cancelKeel(now) {
		for (const o of this.orders.values()) if (o.state === "open" && o.label.startsWith(labelPrefix())) this.cancel(o.id, now);
	}
	openOrders() {
		return [...this.orders.values()].filter((o) => o.state === "open");
	}
	match(now) {
		for (const o of this.orders.values()) {
			if (o.state !== "open") continue;
			const last = this.lastTrade[o.currency];
			const through = o.side === "buy" ? last <= o.price : last >= o.price;
			const age = (now - o.createdAt) / 1e3;
			const queueHit = this.rng() < Math.min(.55, .08 + age / 40);
			if (!through && !queueHit) continue;
			const chunk = floorTo(o.remainingUsd * (.35 + this.rng() * .65), 1);
			const fill = Math.max(o.currency === "BTC" ? 10 : 1, Math.min(o.remainingUsd, chunk || o.remainingUsd));
			o.filledUsd += fill;
			o.remainingUsd = Math.max(0, o.amountUsd - o.filledUsd);
			o.updatedAt = now;
			this.applyFill(o.instrument, o.currency, o.side, fill, o.price);
			if (o.remainingUsd <= 0) o.state = "filled";
		}
	}
	applyFill(instrument, ccy, side, usd, price) {
		let p = this.linear[instrument];
		if (!p) {
			p = {
				currency: ccy,
				sizeUsd: 0,
				avgPrice: price
			};
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
};
var EMPTY_ACCOUNT = {
	equity: 0,
	margin: 0,
	available: 0,
	deltaTotal: 0
};
var CIRCUIT_LIMIT = 5;
var CIRCUIT_COOL_MS = 3e4;
var WATCHDOG_MS = 2e4;
var DASH_STALE_MS = 45e3;
var BOOK_STALE_MS = 4e3;
var INDEX_DIVERGE = .008;
function cloneConfig(c) {
	const threshold = {
		BTC: c.threshold?.BTC ?? .1,
		ETH: c.threshold?.ETH ?? 1
	};
	return {
		...c,
		threshold,
		thresholdPos: {
			BTC: c.thresholdPos?.BTC ?? threshold.BTC,
			ETH: c.thresholdPos?.ETH ?? threshold.ETH
		},
		thresholdNeg: {
			BTC: c.thresholdNeg?.BTC ?? threshold.BTC,
			ETH: c.thresholdNeg?.ETH ?? threshold.ETH
		},
		maxHedgeUsd: {
			BTC: c.maxHedgeUsd?.BTC ?? 25e4,
			ETH: c.maxHedgeUsd?.ETH ?? 15e4
		},
		targetDelta: {
			BTC: c.targetDelta?.BTC ?? 0,
			ETH: c.targetDelta?.ETH ?? 0
		},
		currencies: [...c.currencies ?? ["BTC", "ETH"]],
		hedgeSkip: [...c.hedgeSkip ?? []],
		hedgeFull: c.hedgeFull !== false,
		autoSelectNew: c.autoSelectNew !== false,
		edition: "pro",
		deltaUnit: c.deltaUnit === "usd" ? "usd" : "coin",
		longInstrument: {
			BTC: c.longInstrument?.BTC || PERP.BTC,
			ETH: c.longInstrument?.ETH || PERP.ETH
		},
		shortInstrument: {
			BTC: c.shortInstrument?.BTC || PERP.BTC,
			ETH: c.shortInstrument?.ETH || PERP.ETH
		},
		orderAmountCoin: {
			BTC: c.orderAmountCoin?.BTC ?? 0,
			ETH: c.orderAmountCoin?.ETH ?? 0
		},
		hedgeTimeoutSec: c.hedgeTimeoutSec ?? 60,
		stayAlive: c.stayAlive === true
	};
}
var HedgeEngine = class {
	venue = "paper";
	armed = false;
	connected = false;
	clientIdMasked = "";
	config = cloneConfig(DEFAULT_CONFIG);
	positions = [];
	orders = [];
	cycles = [];
	tape = [];
	series = [];
	policyLog = [];
	lastCycleAt = 0;
	lastQuoteAt = 0;
	lastTickAt = 0;
	lastClientAt = 0;
	lastServerAt = 0;
	lastOkAt = Date.now();
	lastWakeAt = 0;
	startedAt = Date.now();
	indices = {
		BTC: 0,
		ETH: 0
	};
	books = {};
	account = {
		BTC: EMPTY_ACCOUNT,
		ETH: EMPTY_ACCOUNT
	};
	lastError = null;
	cycleSeq = 1;
	coach = null;
	liveStale = false;
	paper;
	deribit = null;
	webhookUrl = null;
	indexSource = "paper";
	circuit = "closed";
	circuitOpenedAt = 0;
	consecutiveFailures = 0;
	alerts = [];
	serverLoop = false;
	busy = false;
	lastTuneAt = 0;
	unhedgedUsd = 0;
	hedgedUsd = 0;
	lastMark = {
		BTC: 0,
		ETH: 0
	};
	lastDelta = {
		BTC: 0,
		ETH: 0
	};
	lastTuneN = 0;
	alertSeq = 1;
	lastRaise = {};
	pendingNotify = [];
	skipped = /* @__PURE__ */ new Set();
	seenInstruments = /* @__PURE__ */ new Set();
	cyclePlan = /* @__PURE__ */ new Map();
	constructor() {
		this.paper = new PaperWorld(Date.now());
		this.indices = { ...this.paper.indices };
		const now = Date.now();
		this.positions = this.paper.positions(now);
		for (const inst of this.hedgeInstruments()) this.books[inst] = this.paper.book(inst, now);
		this.refreshAccount();
		this.log("info", "Paper book ready — short gamma vs Deribit-style perps. Save and Run, or paste keys.");
	}
	warmup(now) {
		const start = now - 9e4;
		this.paper.rewind(start);
		this.series = [];
		this.unhedgedUsd = 0;
		this.hedgedUsd = 0;
		this.lastMark = {
			BTC: 0,
			ETH: 0
		};
		this.lastDelta = {
			BTC: 0,
			ETH: 0
		};
		for (let t = start; t <= now; t += 3e3) {
			this.paper.advance(t);
			this.indices = { ...this.paper.indices };
			this.positions = this.paper.positions(t);
			for (const inst of this.hedgeInstruments()) this.books[inst] = this.paper.book(inst, t);
			this.recordSeries(t);
		}
		this.refreshAccount();
	}
	log(level, message, currency) {
		this.tape.unshift({
			t: Date.now(),
			level,
			message: redact(message),
			currency
		});
		if (this.tape.length > 180) this.tape.length = 180;
	}
	health() {
		const now = Date.now();
		const dashboardStale = this.armed && this.lastClientAt > 0 && now - this.lastClientAt > DASH_STALE_MS && !this.config.stayAlive;
		const unackedCritical = this.alerts.filter((a) => !a.acked && a.severity === "critical").length;
		let status = "ok";
		if (this.circuit === "open" || unackedCritical > 0 || this.consecutiveFailures >= 3) status = "critical";
		else if (this.consecutiveFailures > 0 || dashboardStale || this.circuit === "half_open" || this.config.stayAlive && this.armed && this.lastWakeAt > 0 && now - this.lastWakeAt > 18e4) status = "degraded";
		const cooldownMs = this.circuit === "open" ? Math.max(0, CIRCUIT_COOL_MS - (now - this.circuitOpenedAt)) : 0;
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
			lastWakeAt: this.lastWakeAt
		};
	}
	snapshot() {
		const greeks = {
			BTC: sumGreeks(this.positions, "BTC"),
			ETH: sumGreeks(this.positions, "ETH")
		};
		const quality = qualityFromCycles(this.cycles);
		const suggestions = suggestionsFrom({
			quality,
			config: this.config,
			gamma: {
				BTC: greeks.BTC.gamma,
				ETH: greeks.ETH.gamma
			}
		});
		const nextCycleAt = this.armed ? this.lastCycleAt ? this.lastCycleAt + this.config.intervalSec * 1e3 : Date.now() : 0;
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
				ETH: { ...this.account.ETH }
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
			stayAlivePersisted: false
		};
	}
	raise(input) {
		const key = `${input.kind}:${input.currency ?? ""}`;
		const minGap = input.severity === "critical" ? 8e3 : 2e4;
		const last = this.lastRaise[key] ?? 0;
		if (Date.now() - last < minGap) return null;
		this.lastRaise[key] = Date.now();
		const alert = {
			id: `a-${Date.now()}-${this.alertSeq++}`,
			t: Date.now(),
			severity: input.severity,
			kind: input.kind,
			title: input.title,
			detail: redact(input.detail),
			currency: input.currency,
			acked: false
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
	ackAlerts(ids) {
		if (!ids || ids.length === 0) {
			this.alerts = this.alerts.map((a) => ({
				...a,
				acked: true
			}));
			return;
		}
		const set = new Set(ids);
		this.alerts = this.alerts.map((a) => set.has(a.id) ? {
			...a,
			acked: true
		} : a);
	}
	setConfig(patch) {
		this.config = cloneConfig({
			...this.config,
			...patch,
			threshold: {
				...this.config.threshold,
				...patch.threshold ?? {}
			},
			thresholdPos: {
				...this.config.thresholdPos,
				...patch.thresholdPos ?? {}
			},
			thresholdNeg: {
				...this.config.thresholdNeg,
				...patch.thresholdNeg ?? {}
			},
			maxHedgeUsd: {
				...this.config.maxHedgeUsd,
				...patch.maxHedgeUsd ?? {}
			},
			targetDelta: {
				...this.config.targetDelta,
				...patch.targetDelta ?? {}
			},
			currencies: patch.currencies ? [...patch.currencies] : [...this.config.currencies],
			hedgeSkip: patch.hedgeSkip ? [...patch.hedgeSkip] : [...this.config.hedgeSkip ?? []],
			longInstrument: {
				...this.config.longInstrument,
				...patch.longInstrument ?? {}
			},
			shortInstrument: {
				...this.config.shortInstrument,
				...patch.shortInstrument ?? {}
			},
			orderAmountCoin: {
				...this.config.orderAmountCoin,
				...patch.orderAmountCoin ?? {}
			}
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
		if (this.config.freqPolicy === "min_rv") this.config.intervalSec = secFromFreq(freqFromSec(this.config.intervalSec));
		else if (this.config.freqPolicy !== "manual") this.config.freqPolicy = "manual";
		const unit = this.config.deltaUnit === "usd" ? "USD" : "coin";
		this.log("info", `Config · ${unit} · clock ${this.config.intervalSec}s · ratio ${this.config.hedgePct}% · Δ* BTC ${td.BTC} ETH ${td.ETH}`);
	}
	arm() {
		if (this.venue !== "paper" && !this.connected) throw new Error("Connect API keys before arming a live venue.");
		if (this.circuit === "open") {
			const left = CIRCUIT_COOL_MS - (Date.now() - this.circuitOpenedAt);
			if (left > 0) throw new Error(`Circuit cooling down — wait ${Math.ceil(left / 1e3)}s before re-arm.`);
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
		if (!fromTrip) this.raise({
			severity: "warn",
			kind: "kill",
			title: "Kill",
			detail: "All hedger maker orders cancelled."
		});
	}
	async trip(kind, detail) {
		this.circuit = "open";
		this.circuitOpenedAt = Date.now();
		this.armed = false;
		this.raise({
			severity: "critical",
			kind: kind === "watchdog" || kind === "auth_fail" || kind === "tick_fail" ? kind : "circuit_open",
			title: "Fail-safe trip",
			detail
		});
		await this.cancelAllKeel();
	}
	async watchdog(now = Date.now()) {
		if (!this.armed) return;
		if (this.circuit === "open") return;
		if (now - this.lastOkAt > WATCHDOG_MS) await this.trip("watchdog", `No successful hedge tick in ${Math.round(WATCHDOG_MS / 1e3)}s. Fail-safe kill.`);
	}
	async cancelAllKeel() {
		const now = Date.now();
		if (this.venue === "paper") {
			this.paper.cancelKeel(now);
			this.orders = this.paper.openOrders();
			this.log("warn", "Kill — cancelled all hedger maker orders.");
			return;
		}
		const d = this.deribit;
		if (!d) {
			this.orders = this.orders.map((o) => o.state === "open" && isKeelLabel(o.label) ? {
				...o,
				state: "cancelled"
			} : o);
			return;
		}
		for (let pass = 0; pass < 2; pass++) {
			const open = this.orders.filter((o) => o.state === "open" && isKeelLabel(o.label));
			const labels = [...new Set(open.map((o) => o.label))];
			await Promise.allSettled(labels.map((l) => d.cancelByLabel(l, l.includes("-ETH-") ? "ETH" : "BTC")));
			await Promise.allSettled(open.map((o) => d.cancel(o.id)));
			try {
				const [btc, eth] = await Promise.all([d.getOpenOrders("BTC"), d.getOpenOrders("ETH")]);
				this.orders = [...btc, ...eth];
			} catch (err) {
				this.log("error", `Reconcile orders failed: ${redact(err)}`);
				break;
			}
			if (!this.orders.filter((o) => o.state === "open" && isKeelLabel(o.label)).length) break;
		}
		this.orders = this.orders.map((o) => o.state === "open" && isKeelLabel(o.label) ? {
			...o,
			state: "cancelled"
		} : o);
		this.log("warn", "Kill — cancelled all hedger maker orders (two-pass).");
	}
	async tick(source = "client") {
		if (this.busy) return this.snapshot();
		this.busy = true;
		const now = Date.now();
		this.lastTickAt = now;
		if (source === "client") this.lastClientAt = now;
		else this.lastServerAt = now;
		this.skipped = /* @__PURE__ */ new Set();
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
			if (this.health().dashboardStale) this.raise({
				severity: "warn",
				kind: "dashboard",
				title: "Dashboard heartbeat lost",
				detail: "Tab idle — server loop is still hedging."
			});
		} catch (err) {
			const msg = redact(err);
			this.lastError = msg;
			this.consecutiveFailures += 1;
			this.log("error", msg);
			this.raise({
				severity: this.consecutiveFailures >= 3 ? "critical" : "warn",
				kind: "tick_fail",
				title: "Tick failed",
				detail: msg
			});
			if (this.consecutiveFailures >= CIRCUIT_LIMIT && this.armed) await this.trip("tick_fail", `${this.consecutiveFailures} consecutive tick failures. Fail-safe kill.`);
		} finally {
			this.busy = false;
		}
		return this.snapshot();
	}
	async tickPaper(now) {
		this.paper.advance(now);
		this.indices = { ...this.paper.indices };
		this.indexSource = "paper";
		for (const inst of this.hedgeInstruments()) try {
			this.books[inst] = this.paper.book(inst, now);
		} catch {}
		this.positions = this.paper.positions(now);
		this.orders = this.paper.openOrders();
		this.refreshAccount();
		if (!this.armed) return;
		if (this.circuit === "open") return;
		await this.manage(now);
	}
	hedgeInstruments() {
		const set = /* @__PURE__ */ new Set([PERP.BTC, PERP.ETH]);
		for (const ccy of CURRENCIES) {
			set.add(this.config.longInstrument[ccy] || PERP[ccy]);
			set.add(this.config.shortInstrument[ccy] || PERP[ccy]);
		}
		for (const name of this.paper.datedNames.BTC) set.add(name);
		for (const name of this.paper.datedNames.ETH) set.add(name);
		return [...set];
	}
	deltaCoin(ccy) {
		const g = sumGreeks(this.hedgeBook(), ccy);
		const full = this.config.hedgeFull !== false;
		if (this.venue !== "paper" && full) {
			const v = this.account[ccy]?.deltaTotal;
			if (typeof v === "number" && Number.isFinite(v)) return v;
		}
		return g.delta;
	}
	planFor(ccy) {
		const g = sumGreeks(this.hedgeBook(), ccy);
		const index = this.indices[ccy] || 0;
		const unit = this.config.deltaUnit;
		const target = this.config.targetDelta[ccy] ?? 0;
		const deltaCoin = this.deltaCoin(ccy);
		const greeks = {
			...g,
			delta: deltaCoin
		};
		const current = ddhCurrent(deltaCoin, index, unit);
		const thr = ddhThresholds(this.config, ccy);
		const dev = deviationDelta(current, target);
		const fire = ddhFire(dev.raw, thr.pos, thr.neg);
		const ratio = clamp(this.config.hedgePct, 0, 150) / 100;
		return {
			g: greeks,
			index,
			unit,
			target,
			current,
			thr,
			dev,
			fire,
			ratio,
			usdRaw: fire ? ddhHedgeUsd({
				raw: dev.raw,
				index,
				ratio,
				unit
			}) : 0
		};
	}
	async tickLive(now) {
		const d = this.deribit;
		if (!d) throw new Error("Not connected.");
		const wrap = async (p, name) => {
			try {
				return {
					ok: true,
					v: await p
				};
			} catch (err) {
				return {
					ok: false,
					e: `${name}: ${redact(err)}`
				};
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
			wrap(d.getOpenOrders("ETH"), "ETH orders")
		]);
		const fails = [
			btcIdx,
			ethIdx,
			btcBook,
			ethBook,
			btcPos,
			ethPos,
			btcAcct,
			ethAcct,
			btcOrd,
			ethOrd
		].filter((b) => !b.ok);
		if (fails.length >= 6) throw new Error(`Live snapshot degraded (${fails.length}/10). ${fails[0]?.e ?? ""}`);
		for (const f of fails) this.log("warn", f.e);
		if (fails.length) this.raise({
			severity: fails.length >= 3 ? "warn" : "info",
			kind: "stale",
			title: "Partial venue snapshot",
			detail: `${fails.length} of 10 live calls failed. Hedging the healthy currency only.`
		});
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
				const box = extras[i];
				if (box.ok) this.books[extraInst[i]] = box.v;
			}
		}
		const pos = [];
		if (btcPos.ok) pos.push(...btcPos.v);
		else this.skipped.add("BTC");
		if (ethPos.ok) pos.push(...ethPos.v);
		else this.skipped.add("ETH");
		this.positions = pos;
		if (btcAcct.ok) this.account.BTC = btcAcct.v;
		if (ethAcct.ok) this.account.ETH = ethAcct.v;
		const ords = [];
		if (btcOrd.ok) ords.push(...btcOrd.v);
		if (ethOrd.ok) ords.push(...ethOrd.v);
		this.orders = ords.filter((o) => isKeelLabel(o.label) || o.state === "open");
		if (!this.armed) return;
		if (this.circuit === "open") return;
		await this.manage(now);
	}
	refreshAccount() {
		for (const ccy of CURRENCIES) {
			const g = sumGreeks(this.positions, ccy);
			const equity = ccy === "BTC" ? 12.4 : 84;
			this.account[ccy] = {
				equity,
				margin: Math.abs(g.delta) * .08,
				available: equity * .7,
				deltaTotal: g.delta
			};
		}
	}
	bookHealthy(ccy, now, instrument = PERP[ccy]) {
		const book = this.books[instrument] ?? this.books[PERP[ccy]];
		const index = this.indices[ccy];
		if (!book || !index) {
			this.raise({
				severity: "warn",
				kind: "book",
				title: `${ccy} book missing`,
				detail: "Skip hedge this cycle.",
				currency: ccy
			});
			return false;
		}
		if (this.venue !== "paper" && book.ts > 0 && now - book.ts > BOOK_STALE_MS) {
			this.raise({
				severity: "warn",
				kind: "book",
				title: `${ccy} book stale`,
				detail: `Book age ${((now - book.ts) / 1e3).toFixed(1)}s — skip.`,
				currency: ccy
			});
			return false;
		}
		if (book.mid > 0 && Math.abs(book.mid - index) / index > INDEX_DIVERGE) {
			this.raise({
				severity: "warn",
				kind: "index",
				title: `${ccy} index/mid diverge`,
				detail: `Mid ${book.mid.toFixed(1)} vs index ${index.toFixed(1)} — skip.`,
				currency: ccy
			});
			return false;
		}
		return true;
	}
	async manage(now) {
		await this.progressOpenCycles(now);
		if (!this.lastCycleAt || now - this.lastCycleAt >= this.config.intervalSec * 1e3) {
			await this.startCycles(now);
			this.lastCycleAt = now;
			this.lastQuoteAt = now;
			return;
		}
		if (now - this.lastQuoteAt >= this.config.quoteRefreshSec * 1e3) {
			await this.requote(now);
			this.lastQuoteAt = now;
		}
	}
	async finishCycle(c, now, reason) {
		const g = sumGreeks(this.hedgeBook(), c.currency);
		const filled = this.filledForCycle(c);
		const working = this.orders.filter((o) => o.state === "open" && o.currency === c.currency && isKeelLabel(o.label) && o.label.startsWith(`keel-${c.currency}-${c.id}`));
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
		this.log("info", `${c.currency} cycle #${c.id} ${reason ?? "done"} · filled ${c.filledUsd.toFixed(0)} USD · residual Δ ${g.delta.toFixed(4)} · fill ${(c.fillRate * 100).toFixed(0)}%`, c.currency);
		const plan = this.planFor(c.currency);
		const target = this.config.targetDelta[c.currency] ?? 0;
		const expectedCoin = target + (c.startDelta - target) * (1 - plan.ratio);
		const dust = (c.currency === "BTC" ? 10 : 1) / Math.max(1, this.indices[c.currency] || 1);
		const liveDelta = this.deltaCoin(c.currency);
		if (Math.abs(liveDelta - expectedCoin) > Math.max(dust * 8, .02) && c.fillRate > .5) this.raise({
			severity: "critical",
			kind: "residual",
			title: `${c.currency} residual after clock`,
			detail: `Δ ${liveDelta.toFixed(4)} after ${this.config.hedgePct}% hedge (expected ~${expectedCoin.toFixed(4)}).`,
			currency: c.currency
		});
	}
	async progressOpenCycles(now) {
		const open = this.cycles.filter((c) => c.endedAt === null);
		for (const c of open) {
			const plan = this.cyclePlan.get(c.id);
			c.filledUsd = this.filledForCycle(c).usd;
			const working = this.orders.filter((o) => o.state === "open" && o.label.startsWith(`keel-${c.currency}-${c.id}`));
			if (plan && now >= plan.timeoutAt) {
				this.log("policy", `${c.currency} slice timeout — requote until next clock`, c.currency);
				plan.timeoutAt = now + Math.max(this.config.hedgeTimeoutSec, this.config.intervalSec) * 1e3;
			}
			if (plan && working.length === 0) {
				if (plan.next >= plan.slices.length) {
					await this.finishCycle(c, now, "filled");
					continue;
				}
				const slice = plan.slices[plan.next];
				plan.next += 1;
				c.orders = plan.next;
				if (!this.bookHealthy(c.currency, now, plan.instrument)) continue;
				const book = this.books[plan.instrument];
				if (!book) continue;
				const tick = c.currency === "BTC" ? .5 : .05;
				const px = makerPrice({
					side: plan.side,
					bestBid: book.bestBid,
					bestAsk: book.bestAsk,
					tick,
					offsetTicks: this.config.quoteOffsetTicks
				});
				if (px === null) continue;
				const label = `${makeLabel(c.currency, c.id)}-${plan.next}`;
				await this.place(c.currency, plan.side, slice, px, label, now, plan.instrument);
				this.log("info", `${c.currency} slice ${plan.next}/${plan.slices.length} ${plan.side} ${slice.toFixed(0)} USD @ ${px} ${plan.instrument}`, c.currency);
			}
		}
	}
	async closeOpenCycles(now, reason = "closed") {
		const open = this.cycles.filter((c) => c.endedAt === null);
		for (const c of open) await this.finishCycle(c, now, reason);
	}
	filledForCycle(c) {
		const mine = this.orders.filter((o) => o.label === makeLabel(c.currency, c.id) || o.label.startsWith(`keel-${c.currency}-${c.id}`));
		const usd = mine.reduce((s, o) => s + o.filledUsd, 0);
		const notional = mine.reduce((s, o) => s + o.filledUsd * o.price, 0);
		return {
			usd,
			avgFill: usd > 0 ? notional / usd : null
		};
	}
	noteNewPositions() {
		for (const p of this.positions) {
			if (this.seenInstruments.has(p.instrument)) continue;
			this.seenInstruments.add(p.instrument);
			if (!this.config.hedgeFull && !this.config.autoSelectNew) {
				if (!this.config.hedgeSkip.includes(p.instrument)) this.config.hedgeSkip = [...this.config.hedgeSkip, p.instrument];
			}
		}
	}
	hedgeBook() {
		this.noteNewPositions();
		return includedPositions(this.positions, this.config.hedgeFull !== false, this.config.hedgeSkip ?? []);
	}
	async startCycles(now) {
		await this.closeOpenCycles(now, "clock rollover");
		for (const ccy of this.config.currencies) {
			if (this.skipped.has(ccy)) {
				this.log("warn", `${ccy} skipped — stale positions this tick`, ccy);
				continue;
			}
			const live = this.planFor(ccy);
			const minUsd = ccy === "BTC" ? 10 : 1;
			if (!live.fire) {
				this.log("info", `${ccy} clock ${this.config.intervalSec}s · Δ ${live.g.delta.toFixed(4)} residual ${live.dev.raw.toFixed(4)} inside +${live.thr.pos}/−${live.thr.neg} — skip`, ccy);
				continue;
			}
			if (Math.abs(live.usdRaw) < minUsd) {
				this.log("info", `${ccy} clock · hedge ${live.usdRaw.toFixed(0)} USD under min ${minUsd} — skip`, ccy);
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
			const side = live.fire === "long" ? "buy" : "sell";
			const tick = ccy === "BTC" ? .5 : .05;
			const px = makerPrice({
				side,
				bestBid: book.bestBid,
				bestAsk: book.bestAsk,
				tick,
				offsetTicks: this.config.quoteOffsetTicks
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
				instrument
			});
			if (this.cycles.length > 200) this.cycles.length = 200;
			this.cyclePlan.set(id, {
				slices,
				next: 1,
				instrument,
				timeoutAt: now + Math.max(this.config.hedgeTimeoutSec, this.config.intervalSec) * 1e3,
				side
			});
			const label = `${makeLabel(ccy, id)}-1`;
			await this.place(ccy, side, slices[0], px, label, now, instrument);
			this.log("info", `${ccy} clock ${this.config.intervalSec}s · ${dir} ${side} ${slices[0].toFixed(0)}/${amount.toFixed(0)} USD @ ${px} ${instrument} · Δ ${live.g.delta.toFixed(4)} → ${live.target}`, ccy);
		}
	}
	async requote(now) {
		for (const o of this.orders.filter((x) => x.state === "open" && isKeelLabel(x.label))) {
			if (!this.bookHealthy(o.currency, now, o.instrument)) continue;
			const book = this.books[o.instrument];
			if (!book) continue;
			const tick = o.currency === "BTC" ? .5 : .05;
			const px = makerPrice({
				side: o.side,
				bestBid: book.bestBid,
				bestAsk: book.bestAsk,
				tick,
				offsetTicks: this.config.quoteOffsetTicks
			});
			if (px === null) continue;
			if (Math.abs(px - o.price) < tick * .5) continue;
			await this.replace(o, px, now);
			this.log("info", `Requote ${o.currency} ${o.side} ${o.remainingUsd.toFixed(0)} @ ${px}`, o.currency);
		}
	}
	async place(ccy, side, amount, price, label, now, instrument = PERP[ccy]) {
		if (this.venue === "paper") {
			if (this.paper.placeMaker({
				instrument,
				side,
				price,
				amountUsd: amount,
				now,
				label,
				rejectPostOnly: this.config.rejectPostOnly
			}).state === "rejected") {
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
				rejectPostOnly: this.config.rejectPostOnly
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
				postOnly: true
			});
		} catch (err) {
			const msg = redact(err);
			this.raise({
				severity: "warn",
				kind: "place_fail",
				title: `${ccy} place failed`,
				detail: msg,
				currency: ccy
			});
		}
	}
	async replace(order, price, now) {
		if (this.venue === "paper") {
			this.paper.cancel(order.id, now);
			if (this.paper.placeMaker({
				instrument: order.instrument,
				side: order.side,
				price,
				amountUsd: order.remainingUsd,
				now,
				label: order.label,
				rejectPostOnly: this.config.rejectPostOnly
			}).state === "rejected") this.log("warn", `Requote rejected ${order.currency} @ ${price}`, order.currency);
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
	async cancelOrder(order) {
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
			} catch {}
		}
	}
	recordSeries(now) {
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
		this.lastDelta = {
			BTC: gBtc.optionDelta,
			ETH: gEth.optionDelta
		};
		this.series.push({
			t: now,
			btcDelta,
			ethDelta,
			btcResidual: btcDelta,
			ethResidual: ethDelta,
			btcIndex: this.indices.BTC,
			ethIndex: this.indices.ETH,
			btcHedgeUsd: this.orders.filter((o) => o.currency === "BTC" && o.state === "open").reduce((s, o) => s + o.remainingUsd, 0),
			ethHedgeUsd: this.orders.filter((o) => o.currency === "ETH" && o.state === "open").reduce((s, o) => s + o.remainingUsd, 0),
			btcPerpDelta: gBtc.perpDelta,
			ethPerpDelta: gEth.perpDelta,
			unhedgedUsd: this.unhedgedUsd,
			hedgedUsd: this.unhedgedUsd + this.hedgedUsd
		});
		if (this.series.length > 720) this.series.splice(0, this.series.length - 720);
	}
	maybeTune(now) {
		if (!this.config.autoTune) return;
		if (now - this.lastTuneAt < 8 * this.config.intervalSec * 1e3) return;
		const quality = qualityFromCycles(this.cycles);
		if (quality.n < 6 || quality.n === this.lastTuneN) return;
		const gBtc = sumGreeks(this.positions, "BTC");
		const gEth = sumGreeks(this.positions, "ETH");
		const { config, changes } = autoTune(this.config, quality, {
			BTC: gBtc.gamma,
			ETH: gEth.gamma
		}, now);
		this.lastTuneAt = now;
		this.lastTuneN = quality.n;
		if (!changes.length) return;
		this.config = config;
		this.policyLog.unshift(...changes);
		for (const ch of changes) this.log("policy", `Auto-tune ${ch.field}: ${String(ch.from)} → ${String(ch.to)} · ${ch.reason}`);
	}
};
var g$2 = globalThis;
var RV_REV = 4;
var TTL_MS = 6e5;
var BASE = "https://www.deribit.com";
async function chartChunk(instrument, resolution, fromSec, toSec) {
	const q = new URLSearchParams({
		instrument_name: instrument,
		resolution,
		start_timestamp: String(fromSec * 1e3),
		end_timestamp: String(toSec * 1e3)
	});
	const json = await (await fetch(`${BASE}/api/v2/public/get_tradingview_chart_data?${q}`, {
		headers: { accept: "application/json" },
		signal: AbortSignal.timeout(12e3)
	})).json();
	if (json.error) throw new Error(json.error.message);
	const r = json.result;
	if (!r?.ticks?.length || r.status === "no_data") return [];
	const out = [];
	for (let i = 0; i < r.ticks.length; i++) {
		const c = r.close?.[i];
		if (!c) continue;
		out.push({
			t: Math.floor(r.ticks[i] / 1e3),
			o: r.open?.[i] ?? c,
			h: r.high?.[i] ?? c,
			l: r.low?.[i] ?? c,
			c
		});
	}
	return out;
}
async function fetchRange(instrument, resolution, days) {
	const to = Math.floor(Date.now() / 1e3);
	const from = to - days * 86400;
	const span = 4e3 * (resolution === "1D" ? 1440 : Number(resolution)) * 60;
	const windows = [];
	for (let t = from; t < to; t += span) windows.push([t, Math.min(t + span, to)]);
	const bars = [];
	for (let i = 0; i < windows.length; i += 3) {
		const batch = windows.slice(i, i + 3);
		const parts = await Promise.all(batch.map(([a, b]) => chartChunk(instrument, resolution, a, b).catch(() => [])));
		for (const p of parts) bars.push(...p);
	}
	bars.sort((a, b) => a.t - b.t);
	const uniq = [];
	let last = -1;
	for (const b of bars) {
		if (b.t === last) continue;
		last = b.t;
		uniq.push(b);
	}
	return uniq;
}
async function barsFor(ccy) {
	const inst = PERP[ccy];
	const [m1, m5] = await Promise.all([fetchRange(inst, "1", 30), fetchRange(inst, "5", 30)]);
	if (!m1.length) return m5;
	if (!m5.length) return m1;
	const cut = m1[0].t;
	return [...m5.filter((b) => b.t < cut - 30), ...m1];
}
async function compute() {
	const now = Math.floor(Date.now() / 1e3);
	const [btc, eth] = await Promise.all([barsFor("BTC"), barsFor("ETH")]);
	return {
		BTC: btc.length ? buildSurface("BTC", btc, now) : emptySurface("BTC"),
		ETH: eth.length ? buildSurface("ETH", eth, now) : emptySurface("ETH")
	};
}
function getRvCache() {
	const c = g$2.__keelRv;
	if (!c || !c.at) return null;
	return {
		BTC: c.BTC,
		ETH: c.ETH
	};
}
function refreshRv(force = false) {
	if (!g$2.__keelRv || g$2.__keelRvRev !== RV_REV) {
		g$2.__keelRv = {
			BTC: emptySurface("BTC"),
			ETH: emptySurface("ETH"),
			at: 0,
			loading: null,
			lastAttempt: 0
		};
		g$2.__keelRvRev = RV_REV;
	}
	const c = g$2.__keelRv;
	if (!force && c.at && Date.now() - c.at < TTL_MS) return c.loading ?? Promise.resolve();
	if (!force && c.loading) return c.loading;
	if (!force && !c.at && c.lastAttempt && Date.now() - c.lastAttempt < 2e4) return Promise.resolve();
	c.lastAttempt = Date.now();
	c.loading = compute().then((s) => {
		c.BTC = s.BTC;
		c.ETH = s.ETH;
		if (s.BTC.asOf || s.ETH.asOf) c.at = Date.now();
	}).catch(() => {}).finally(() => {
		c.loading = null;
	});
	return c.loading;
}
var PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|::1|\[::1\]|metadata\.google\.internal)$/i;
function assertSafeWebhook(url) {
	let parsed;
	try {
		parsed = new URL(url.trim());
	} catch {
		throw new Error("Webhook URL is not valid.");
	}
	if (parsed.protocol !== "https:") throw new Error("Webhook must be HTTPS.");
	if (PRIVATE_HOST.test(parsed.hostname) || PRIVATE_HOST.test(parsed.hostname + ".")) throw new Error("Webhook host is not allowed.");
	if (!parsed.hostname.includes(".")) throw new Error("Webhook host is not allowed.");
	return parsed.toString();
}
async function postWebhook(url, alert) {
	const line = `[MCM Δ ${alert.severity}] ${alert.title} — ${alert.detail}`;
	const body = JSON.stringify({
		text: line,
		content: line,
		username: "MCM Delta Hedger",
		alert: {
			id: alert.id,
			t: alert.t,
			severity: alert.severity,
			kind: alert.kind,
			title: alert.title,
			detail: alert.detail,
			currency: alert.currency ?? null
		}
	});
	const res = await fetch(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json"
		},
		body,
		signal: AbortSignal.timeout(4e3)
	});
	if (!res.ok) throw new Error(redact(`Webhook HTTP ${res.status}`));
}
var g$1 = globalThis;
function passphrase() {
	const env = process.env.BETTER_AUTH_SECRET?.trim();
	if (env && env.length >= 16) return env;
	g$1.__mcmSealSecret__ ??= randomBytes(32).toString("hex");
	return g$1.__mcmSealSecret__;
}
function key() {
	return scryptSync(passphrase(), "mcm-delta-hedger-v1", 32);
}
function seal(plain) {
	const iv = randomBytes(12);
	const c = createCipheriv("aes-256-gcm", key(), iv);
	const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
	const tag = c.getAuthTag();
	return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}
function openSealed(packed) {
	const [ivB, tagB, dataB] = packed.split(".");
	if (!ivB || !tagB || !dataB) throw new Error("Corrupt sealed payload.");
	const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64url"));
	d.setAuthTag(Buffer.from(tagB, "base64url"));
	return Buffer.concat([d.update(Buffer.from(dataB, "base64url")), d.final()]).toString("utf8");
}
function asArmed(v) {
	return v === true || v === 1 || v === "1" || v === "t" || v === "true";
}
function decode(row) {
	return {
		userId: row.user_id,
		venue: row.venue === "testnet" ? "testnet" : "mainnet",
		clientId: row.client_id,
		clientSecret: openSealed(row.secret_blob),
		webhookUrl: row.webhook_blob ? openSealed(row.webhook_blob) : null,
		config: JSON.parse(row.config_json),
		armed: asArmed(row.armed),
		lastCycleAt: Number(row.last_cycle_at) || 0,
		lastWakeAt: Number(row.last_wake_at) || 0
	};
}
async function upsertSession(s) {
	const sql = await getSql();
	const secretBlob = seal(s.clientSecret);
	const webhookBlob = s.webhookUrl ? seal(s.webhookUrl) : null;
	const configJson = JSON.stringify(s.config);
	const armed = s.armed ? 1 : 0;
	await sql`
    insert into hedge_sessions (user_id, venue, client_id, secret_blob, webhook_blob, config_json, armed, last_cycle_at, last_wake_at, updated_at)
    values (${s.userId}, ${s.venue}, ${s.clientId}, ${secretBlob}, ${webhookBlob}, ${configJson}, ${armed}, ${s.lastCycleAt}, ${s.lastWakeAt}, now())
    on conflict (user_id) do update set
      venue = excluded.venue,
      client_id = excluded.client_id,
      secret_blob = excluded.secret_blob,
      webhook_blob = excluded.webhook_blob,
      config_json = excluded.config_json,
      armed = excluded.armed,
      last_cycle_at = excluded.last_cycle_at,
      last_wake_at = excluded.last_wake_at,
      updated_at = now()
  `;
}
async function deleteSession(userId) {
	await (await getSql())`delete from hedge_sessions where user_id = ${userId}`;
}
async function loadSession(userId) {
	const row = (await (await getSql())`select user_id, venue, client_id, secret_blob, webhook_blob, config_json, armed, last_cycle_at, last_wake_at from hedge_sessions where user_id = ${userId} limit 1`)[0];
	return row ? decode(row) : null;
}
async function listArmedSessions() {
	const rows = await (await getSql())`select user_id, venue, client_id, secret_blob, webhook_blob, config_json, armed, last_cycle_at, last_wake_at from hedge_sessions where armed = 1`;
	const out = [];
	for (const row of rows) try {
		out.push(decode(row));
	} catch {}
	return out;
}
var ENGINE_REV = 18;
var LOOP_MS = 2e3;
var WATCH_MS = 5e3;
var CONNECT_WINDOW_MS = 6e4;
var CONNECT_MAX = 5;
var g = globalThis;
function slots() {
	if (!g.__keelByUser || g.__keelRev !== ENGINE_REV) {
		if (g.__keelLoop) {
			clearInterval(g.__keelLoop);
			g.__keelLoop = void 0;
		}
		if (g.__keelWatch) {
			clearInterval(g.__keelWatch);
			g.__keelWatch = void 0;
		}
		g.__keelByUser = /* @__PURE__ */ new Map();
		g.__keelRev = ENGINE_REV;
	}
	return g.__keelByUser;
}
function slot(userId) {
	const map = slots();
	let s = map.get(userId);
	if (!s) {
		s = {
			engine: new HedgeEngine(),
			connects: [],
			clientId: "",
			clientSecret: "",
			webhook: "",
			hydrated: false,
			persisted: false
		};
		map.set(userId, s);
		startLoops();
	}
	return s;
}
function startLoops() {
	if (!g.__keelLoop) g.__keelLoop = setInterval(() => {
		(async () => {
			for (const s of slots().values()) try {
				s.engine.serverLoop = true;
				if (!s.seed) s.seed = seedPaperIndex(s.engine);
				await s.seed;
				await s.engine.tick("server");
				maybeLockFreq(s.engine);
				await flushNotify(s.engine);
			} catch {}
		})();
	}, LOOP_MS);
	if (!g.__keelWatch) g.__keelWatch = setInterval(() => {
		(async () => {
			for (const s of slots().values()) try {
				s.engine.serverLoop = true;
				await s.engine.watchdog();
				await flushNotify(s.engine);
			} catch {}
		})();
	}, WATCH_MS);
}
async function ensureReady(userId) {
	const s = slot(userId);
	s.engine.serverLoop = true;
	if (!s.seed) s.seed = seedPaperIndex(s.engine);
	await s.seed;
	if (!s.hydrated) {
		s.hydrated = true;
		try {
			await hydrateFromDb(userId);
		} catch (err) {
			s.engine.log("warn", `Stay-on restore failed · ${redact(err)}`);
		}
	}
	return s.engine;
}
async function seedPaperIndex(e) {
	try {
		const idx = await fetchPublicIndex();
		if (idx.BTC > 0 && idx.ETH > 0) {
			e.paper.seedIndex(idx.BTC, idx.ETH);
			e.indices = {
				BTC: idx.BTC,
				ETH: idx.ETH
			};
			e.indexSource = idx.source;
			e.log("info", `Paper marks seeded from Deribit index (${idx.source}) · BTC ${idx.BTC.toFixed(0)} · ETH ${idx.ETH.toFixed(0)}`);
		}
	} catch {
		e.log("warn", "Public index fetch failed — using default paper marks.");
		e.raise({
			severity: "warn",
			kind: "index",
			title: "Index seed failed",
			detail: "Public Deribit index unreachable. Paper using fallback marks."
		});
	}
	e.warmup(Date.now());
	refreshRv();
}
function withRv(e, userId) {
	maybeLockFreq(e);
	e.serverLoop = true;
	const snap = {
		...e.snapshot(),
		rv: getRvCache()
	};
	if (userId) snap.stayAlivePersisted = slot(userId).persisted;
	return snap;
}
function wipeCreds(userId) {
	const s = slot(userId);
	s.clientId = "";
	s.clientSecret = "";
	s.webhook = "";
	s.persisted = false;
}
async function persistIfAlive(userId) {
	const s = slot(userId);
	const e = s.engine;
	if (!e.config.stayAlive || e.venue === "paper" || !s.clientSecret) {
		if (s.persisted) {
			await deleteSession(userId);
			s.persisted = false;
		}
		return;
	}
	await upsertSession({
		userId,
		venue: e.venue === "testnet" ? "testnet" : "mainnet",
		clientId: s.clientId,
		clientSecret: s.clientSecret,
		webhookUrl: e.webhookUrl,
		config: e.config,
		armed: e.armed,
		lastCycleAt: e.lastCycleAt,
		lastWakeAt: e.lastWakeAt
	});
	s.persisted = true;
}
async function hydrateFromDb(userId) {
	const stored = await loadSession(userId);
	if (!stored) return;
	const s = slot(userId);
	const e = s.engine;
	e.setConfig({
		...stored.config,
		stayAlive: true
	});
	if (stored.webhookUrl) try {
		e.webhookUrl = assertSafeWebhook(stored.webhookUrl);
	} catch {
		e.webhookUrl = null;
	}
	if (e.deribit && e.connected && e.venue === stored.venue && s.clientId === stored.clientId) {
		if (!e.lastWakeAt) e.lastWakeAt = stored.lastWakeAt;
		if (stored.armed && !e.armed) {
			e.arm();
			e.lastCycleAt = stored.lastCycleAt;
			e.lastWakeAt = stored.lastWakeAt;
		}
		s.persisted = true;
		return;
	}
	const client = new DeribitClient(stored.venue, stored.clientId, stored.clientSecret);
	await client.authenticate();
	s.clientId = stored.clientId;
	s.clientSecret = stored.clientSecret;
	s.webhook = stored.webhookUrl ?? "";
	e.deribit = client;
	e.venue = stored.venue;
	e.connected = true;
	e.clientIdMasked = client.maskedId();
	e.circuit = "closed";
	e.log("info", `Stay-on restored ${stored.venue} · ${e.clientIdMasked}`);
	e.lastWakeAt = stored.lastWakeAt;
	if (stored.armed) {
		e.arm();
		e.lastCycleAt = stored.lastCycleAt;
		e.lastWakeAt = stored.lastWakeAt;
		if (stored.lastWakeAt && Date.now() - stored.lastWakeAt > 18e4) e.raise({
			severity: "warn",
			kind: "watchdog",
			title: "Background worker stale",
			detail: "No wake in 3+ minutes. Worker should fire every 60s while published."
		});
	}
	s.persisted = true;
	await e.tick("server");
}
async function cronSweep() {
	startLoops();
	const rows = await listArmedSessions();
	const results = [];
	const budgetMs = 45e3;
	for (const row of rows) try {
		const s = slot(row.userId);
		s.hydrated = true;
		const e = s.engine;
		if (!e.deribit || !e.connected || e.venue !== row.venue || s.clientId !== row.clientId) {
			s.hydrated = false;
			await hydrateFromDb(row.userId);
		}
		const live = slot(row.userId).engine;
		const until = Date.now() + budgetMs;
		if (live.armed) {
			live.config.stayAlive = true;
			while (Date.now() < until) {
				await live.tick("server");
				live.lastWakeAt = Date.now();
				if (Date.now() + 1800 >= until) break;
				await new Promise((r) => setTimeout(r, 1800));
			}
		}
		await persistIfAlive(row.userId);
		await flushNotify(live);
		results.push({
			id: live.clientIdMasked || "••••",
			ok: true
		});
	} catch (err) {
		results.push({
			id: "••••",
			ok: false,
			detail: redact(err)
		});
	}
	return {
		t: Date.now(),
		n: results.length,
		results
	};
}
function maybeLockFreq(e) {
	if (e.config.freqPolicy !== "min_rv") return;
	const cache = getRvCache();
	if (!cache) return;
	const best = minRvForLookback(cache.BTC, e.config.targetLookback);
	if (!best) return;
	const sec = secFromFreq(best.freqId);
	if (sec === e.config.intervalSec) return;
	e.config.intervalSec = sec;
	e.log("policy", `Min-RV lock · ${e.config.targetLookback} → ${best.freqId} (${best.rv.toFixed(2)}% composite BTC)`);
}
async function flushNotify(e) {
	const q = e.drainNotify();
	if (!q.length || !e.webhookUrl) return;
	for (const a of q) {
		if (a.severity === "info") continue;
		try {
			await postWebhook(e.webhookUrl, a);
		} catch (err) {
			e.log("error", `Webhook delivery failed: ${redact(err)}`);
		}
	}
}
function allowConnect(userId) {
	const now = Date.now();
	const list = slot(userId).connects;
	while (list.length && now - list[0] > CONNECT_WINDOW_MS) list.shift();
	if (list.length >= CONNECT_MAX) throw new Error("Too many connect attempts. Wait a minute.");
	list.push(now);
}
async function snapshot(userId) {
	const e = await ensureReady(userId);
	refreshRv();
	return withRv(e, userId);
}
async function connect(userId, input) {
	const e = await ensureReady(userId);
	if (input.venue === "paper") {
		e.venue = "paper";
		e.deribit?.wipe();
		e.deribit = null;
		e.connected = true;
		e.clientIdMasked = "";
		e.armed = false;
		wipeCreds(userId);
		await deleteSession(userId);
		if (input.webhookUrl?.trim()) e.webhookUrl = assertSafeWebhook(input.webhookUrl);
		e.log("info", "Venue set to paper. Short-gamma book is simulated; no live orders.");
		await flushNotify(e);
		return withRv(e, userId);
	}
	allowConnect(userId);
	const id = input.clientId.trim();
	const secret = input.clientSecret.trim();
	if (id.length < 8 || secret.length < 8) throw new Error("Client ID and secret look too short.");
	if (input.webhookUrl?.trim()) e.webhookUrl = assertSafeWebhook(input.webhookUrl);
	const client = new DeribitClient(input.venue, id, secret);
	try {
		await client.authenticate();
	} catch (err) {
		e.raise({
			severity: "critical",
			kind: "auth_fail",
			title: "Auth failed",
			detail: redact(err)
		});
		await flushNotify(e);
		throw new Error(redact(err));
	}
	e.deribit = client;
	e.venue = input.venue;
	e.connected = true;
	e.clientIdMasked = client.maskedId();
	e.armed = false;
	e.circuit = "closed";
	const s = slot(userId);
	s.clientId = id;
	s.clientSecret = secret;
	s.webhook = e.webhookUrl ?? "";
	e.log("info", `Authenticated ${input.venue} · ${e.clientIdMasked} · engine stays disarmed until you arm it.`);
	await e.tick("server");
	await persistIfAlive(userId);
	await flushNotify(e);
	return withRv(e, userId);
}
async function disconnect(userId) {
	const e = await ensureReady(userId);
	e.armed = false;
	e.config.stayAlive = false;
	e.deribit?.wipe();
	e.deribit = null;
	e.venue = "paper";
	e.connected = true;
	e.clientIdMasked = "";
	wipeCreds(userId);
	await deleteSession(userId);
	e.log("warn", "Live session dropped. Keys wiped from memory and stay-on store. Back on paper.");
	await flushNotify(e);
	return withRv(e, userId);
}
async function patchConfig(userId, patch) {
	const e = await ensureReady(userId);
	if (patch.stayAlive === true && (e.venue === "paper" || !slot(userId).clientSecret)) throw new Error("Connect live keys before Stay on. Paper cannot persist a live session.");
	const was = e.config.stayAlive;
	e.setConfig(patch);
	await persistIfAlive(userId);
	if (e.config.stayAlive && !was) e.log("info", "Background on — keys encrypted at rest, worker every 1 min.");
	if (!e.config.stayAlive && was) e.log("warn", "Background off — encrypted session deleted.");
	return withRv(e, userId);
}
async function resetConfig(userId) {
	const e = await ensureReady(userId);
	const stay = e.config.stayAlive;
	e.setConfig({
		...restoreConfig(),
		stayAlive: stay
	});
	await persistIfAlive(userId);
	return withRv(e, userId);
}
async function arm(userId, confirm) {
	const e = await ensureReady(userId);
	if (e.venue === "mainnet" && confirm !== "ARM") throw new Error("Type ARM to confirm live mainnet hedging.");
	if (e.venue !== "paper" && slot(userId).clientSecret) {
		if (!e.config.stayAlive) {
			e.config.stayAlive = true;
			e.log("info", "Background on — keys encrypted, worker wakes every 1 min with the tab closed.");
		}
	}
	e.arm();
	await persistIfAlive(userId);
	await flushNotify(e);
	return withRv(e, userId);
}
async function disarm(userId) {
	const e = await ensureReady(userId);
	e.disarm();
	await persistIfAlive(userId);
	return withRv(e, userId);
}
async function kill(userId) {
	const e = await ensureReady(userId);
	await e.kill();
	await persistIfAlive(userId);
	await flushNotify(e);
	return withRv(e, userId);
}
async function tick(userId, source = "client") {
	const e = await ensureReady(userId);
	const s = await e.tick(source);
	maybeLockFreq(e);
	await flushNotify(e);
	return {
		...s,
		rv: getRvCache(),
		stayAlivePersisted: slot(userId).persisted
	};
}
async function runCoach(userId) {
	const e = await ensureReady(userId);
	const snap = e.snapshot();
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) {
		e.coach = {
			t: Date.now(),
			text: snap.suggestions.join("\n") + "\n\n(AI coach unavailable in this environment — showing heuristic notes.)"
		};
		return withRv(e, userId);
	}
	const { coachPrompt } = await import("./evaluate-BOhpaqiB.mjs");
	const prompt = coachPrompt({
		quality: snap.quality,
		config: snap.config,
		suggestions: snap.suggestions,
		cycles: snap.cycles,
		gamma: {
			BTC: snap.greeks.BTC.gamma,
			ETH: snap.greeks.ETH.gamma
		},
		counterfactuals: snap.counterfactuals
	});
	const res = await fetch("https://api.x.ai/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: "grok-4.5",
			max_tokens: 500,
			messages: [{
				role: "user",
				content: prompt
			}]
		})
	});
	if (!res.ok) {
		e.coach = {
			t: Date.now(),
			text: `Coach error ${res.status}. Heuristics:\n${snap.suggestions.join("\n")}`
		};
		return withRv(e, userId);
	}
	const body = await res.json();
	e.coach = {
		t: Date.now(),
		text: body.choices[0]?.message.content ?? "No response."
	};
	e.log("policy", "Coach evaluation recorded.");
	return withRv(e, userId);
}
async function setVenue(userId, venue) {
	const e = await ensureReady(userId);
	if (venue === "paper") return disconnect(userId);
	e.venue = venue;
	e.armed = false;
	e.connected = false;
	e.deribit?.wipe();
	e.deribit = null;
	e.log("info", `Venue ${venue} selected — paste API keys and connect. Engine will not arm until then.`);
	return withRv(e, userId);
}
async function selectRvCell(userId, freqId, lookbackId) {
	const e = await ensureReady(userId);
	e.setConfig({
		intervalSec: secFromFreq(freqId),
		targetLookback: lookbackId,
		freqPolicy: "manual"
	});
	e.log("policy", `Hedge frequency pinned to ${freqId} from ${lookbackId} RV cell.`);
	return withRv(e, userId);
}
async function refreshRvNow(userId) {
	await refreshRv(true);
	return withRv(await ensureReady(userId), userId);
}
async function ackAlerts(userId, ids) {
	const e = await ensureReady(userId);
	e.ackAlerts(ids);
	return withRv(e, userId);
}
async function testAlert(userId) {
	const e = await ensureReady(userId);
	e.raise({
		severity: "critical",
		kind: "test",
		title: "Test fail-safe",
		detail: "Operator fired a test alert. Desktop, in-app, and webhook paths should fire."
	});
	await flushNotify(e);
	return withRv(e, userId);
}
async function tripNow(userId) {
	const e = await ensureReady(userId);
	await e.trip("circuit_open", "Operator tripped the fail-safe. All hedger orders cancelled, circuit open.");
	await flushNotify(e);
	return withRv(e, userId);
}
async function setWebhook(userId, url) {
	const e = await ensureReady(userId);
	if (!url || !url.trim()) {
		e.webhookUrl = null;
		slot(userId).webhook = "";
		e.log("info", "Webhook cleared.");
		await persistIfAlive(userId);
		return withRv(e, userId);
	}
	e.webhookUrl = assertSafeWebhook(url);
	slot(userId).webhook = e.webhookUrl;
	e.log("info", `Webhook set · ${e.snapshot().webhookMasked}`);
	await persistIfAlive(userId);
	return withRv(e, userId);
}
//#endregion
export { ackAlerts, arm, connect, cronSweep, disarm, disconnect, kill, coachPrompt as n, patchConfig, refreshRvNow, resetConfig, runCoach, selectRvCell, setVenue, setWebhook, snapshot, testAlert, tick, tripNow };
