//#region node_modules/.nitro/vite/services/ssr/assets/rv-Buo_bNNw.js
var CURRENCIES = ["BTC", "ETH"];
var PERP = {
	BTC: "BTC-PERPETUAL",
	ETH: "ETH-PERPETUAL"
};
var DEFAULT_CONFIG = {
	intervalSec: 60,
	quoteRefreshSec: 5,
	threshold: {
		BTC: .1,
		ETH: 1
	},
	thresholdPos: {
		BTC: .1,
		ETH: 1
	},
	thresholdNeg: {
		BTC: .1,
		ETH: 1
	},
	targetDelta: {
		BTC: 0,
		ETH: 0
	},
	quoteOffsetTicks: 0,
	rejectPostOnly: true,
	maxHedgeUsd: {
		BTC: 25e4,
		ETH: 15e4
	},
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
	longInstrument: {
		BTC: "BTC-PERPETUAL",
		ETH: "ETH-PERPETUAL"
	},
	shortInstrument: {
		BTC: "BTC-PERPETUAL",
		ETH: "ETH-PERPETUAL"
	},
	orderAmountCoin: {
		BTC: 0,
		ETH: 0
	},
	hedgeTimeoutSec: 60,
	stayAlive: false
};
function clamp(n, lo, hi) {
	return Math.min(hi, Math.max(lo, n));
}
function roundTo(n, step) {
	if (step <= 0) return n;
	return Math.round(n / step) * step;
}
function floorTo(n, step) {
	if (step <= 0) return n;
	return Math.floor(n / step) * step;
}
function roundTick(price, tick) {
	return roundTo(price, tick);
}
function normalCdf(x) {
	const a1 = .254829592;
	const a2 = -.284496736;
	const a3 = 1.421413741;
	const a4 = -1.453152027;
	const a5 = 1.061405429;
	const p = .3275911;
	const sign = x < 0 ? -1 : 1;
	const z = Math.abs(x) / Math.SQRT2;
	const t = 1 / (1 + p * z);
	return .5 * (1 + sign * (1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z)));
}
function normalPdf(x) {
	return Math.exp(-.5 * x * x) / Math.sqrt(2 * Math.PI);
}
function blackScholes(params) {
	const { spot: S, strike: K, vol: sig, isCall } = params;
	const r = params.rate ?? 0;
	const T = Math.max(params.tYears, 1 / 365 / 24);
	const sqrtT = Math.sqrt(T);
	const d1 = (Math.log(S / K) + (r + .5 * sig * sig) * T) / (sig * sqrtT);
	const d2 = d1 - sig * sqrtT;
	const nd1 = normalPdf(d1);
	return {
		delta: isCall ? normalCdf(d1) : normalCdf(d1) - 1,
		gamma: nd1 / (S * sig * sqrtT),
		vega: S * nd1 * sqrtT / 100,
		theta: -S * nd1 * sig / (2 * sqrtT) / 365 + (isCall ? -r * K * Math.exp(-r * T) * normalCdf(d2) : r * K * Math.exp(-r * T) * normalCdf(-d2)) / 365,
		d1
	};
}
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function randn(rng) {
	const u = Math.max(1e-12, rng());
	const v = rng();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function makerPrice(args) {
	const { side, bestBid, bestAsk, tick, offsetTicks } = args;
	if (!(bestBid > 0) || !(bestAsk > 0) || bestAsk <= bestBid) return null;
	if (side === "buy") {
		let px = roundTick(bestBid - offsetTicks * tick, tick);
		const cap = roundTick(bestAsk - tick, tick);
		if (px >= bestAsk) px = cap;
		if (px <= 0) return null;
		return px;
	}
	let px = roundTick(bestAsk + offsetTicks * tick, tick);
	const floor = roundTick(bestBid + tick, tick);
	if (px <= bestBid) px = floor;
	return px;
}
function sumGreeks(positions, ccy) {
	let delta = 0;
	let gamma = 0;
	let vega = 0;
	let theta = 0;
	let optionDelta = 0;
	let perpDelta = 0;
	for (const p of positions) {
		if (p.currency !== ccy) continue;
		delta += p.delta;
		gamma += p.gamma;
		vega += p.vega;
		theta += p.theta;
		if (p.kind === "option" || p.kind === "option_combo") optionDelta += p.delta;
		else perpDelta += p.delta;
	}
	return {
		delta,
		gamma,
		vega,
		theta,
		optionDelta,
		perpDelta
	};
}
function ddhCurrent(deltaCoin, index, unit) {
	return unit === "usd" ? deltaCoin * index : deltaCoin;
}
function ddhThresholds(config, ccy) {
	const fallback = config.threshold[ccy] ?? 0;
	return {
		pos: config.thresholdPos?.[ccy] ?? fallback,
		neg: config.thresholdNeg?.[ccy] ?? fallback
	};
}
function ddhFire(raw, posThr, negThr) {
	if (raw >= posThr && raw > 0) return "short";
	if (-raw >= negThr && raw < 0) return "long";
	return null;
}
function ddhHedgeUsd(args) {
	const unitAmt = -args.ratio * args.raw;
	return args.unit === "usd" ? unitAmt : unitAmt * args.index;
}
function splitNotional(absUsd, sliceUsd, minUsd) {
	if (!(absUsd >= minUsd)) return [];
	const slice = sliceUsd > 0 ? Math.max(minUsd, sliceUsd) : absUsd;
	const parts = [];
	let left = absUsd;
	while (left >= minUsd - 1e-9) {
		const take = Math.min(slice, left);
		if (left - take > 0 && left - take < minUsd) {
			parts.push(floorTo(left, minUsd) || left);
			break;
		}
		const chunk = floorTo(take, minUsd) || take;
		if (chunk < minUsd) break;
		parts.push(chunk);
		left -= chunk;
		if (parts.length > 40) break;
	}
	return parts.filter((x) => x >= minUsd);
}
function hedgeInstrument(config, ccy, fire) {
	const inst = fire === "long" ? config.longInstrument?.[ccy] : config.shortInstrument?.[ccy];
	return inst && inst.length ? inst : PERP[ccy];
}
function includedPositions(positions, hedgeFull, skip) {
	if (hedgeFull) return positions;
	const s = new Set(skip);
	return positions.filter((p) => !s.has(p.instrument));
}
function deviationDelta(current, target) {
	const raw = current - target;
	return {
		raw,
		positive: Math.max(0, raw),
		negative: Math.max(0, -raw)
	};
}
function captureBps(side, fill, mid) {
	if (!mid || !fill) return 0;
	return (side === "sell" ? fill - mid : mid - fill) / mid * 1e4;
}
function labelPrefix() {
	return "keel";
}
function makeLabel(ccy, cycleId) {
	return `keel-${ccy}-${cycleId}`.slice(0, 32);
}
function isKeelLabel(label) {
	return label.startsWith("keel-");
}
function mean(xs) {
	if (!xs.length) return 0;
	return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function rms(xs) {
	if (!xs.length) return 0;
	return Math.sqrt(xs.reduce((a, b) => a + b * b, 0) / xs.length);
}
var MONTHS = {
	JAN: 0,
	FEB: 1,
	MAR: 2,
	APR: 3,
	MAY: 4,
	JUN: 5,
	JUL: 6,
	AUG: 7,
	SEP: 8,
	OCT: 9,
	NOV: 10,
	DEC: 11
};
function parseDeribitExpiry(s) {
	const m = s.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/i);
	if (!m) return null;
	const day = Number(m[1]);
	const mon = MONTHS[m[2].toUpperCase()];
	const year = 2e3 + Number(m[3]);
	if (mon === void 0) return null;
	return Date.UTC(year, mon, day, 8, 0, 0);
}
function parseOptionInstrument(name) {
	const m = name.match(/^(BTC|ETH)-(\d{1,2}[A-Z]{3}\d{2})-(\d+)-([CP])$/i);
	if (!m) return {
		currency: null,
		expiryMs: null,
		strike: null,
		optionType: null
	};
	const currency = m[1].toUpperCase();
	const optionType = m[4].toUpperCase() === "C" ? "call" : "put";
	const strike = Number(m[3]);
	return {
		currency,
		expiryMs: parseDeribitExpiry(m[2]),
		strike,
		optionType
	};
}
var CHECK_INTERVALS = [
	{
		sec: 5,
		label: "5s"
	},
	{
		sec: 10,
		label: "10s"
	},
	{
		sec: 30,
		label: "30s"
	},
	{
		sec: 60,
		label: "1m"
	},
	{
		sec: 300,
		label: "5m"
	},
	{
		sec: 600,
		label: "10m"
	},
	{
		sec: 900,
		label: "15m"
	},
	{
		sec: 1800,
		label: "30m"
	},
	{
		sec: 3600,
		label: "1h"
	}
];
var HEDGE_FREQS = [
	{
		id: "1m",
		sec: 60,
		label: "1m"
	},
	{
		id: "5m",
		sec: 300,
		label: "5m"
	},
	{
		id: "10m",
		sec: 600,
		label: "10m"
	},
	{
		id: "15m",
		sec: 900,
		label: "15m"
	},
	{
		id: "30m",
		sec: 1800,
		label: "30m"
	},
	{
		id: "1h",
		sec: 3600,
		label: "1h"
	},
	{
		id: "2h",
		sec: 7200,
		label: "2h"
	},
	{
		id: "12h",
		sec: 43200,
		label: "12h"
	},
	{
		id: "1d",
		sec: 86400,
		label: "1d"
	}
];
var LOOKBACKS = [
	{
		id: "1d",
		sec: 86400,
		label: "1d"
	},
	{
		id: "3d",
		sec: 259200,
		label: "3d"
	},
	{
		id: "7d",
		sec: 604800,
		label: "7d"
	},
	{
		id: "14d",
		sec: 1209600,
		label: "14d"
	},
	{
		id: "21d",
		sec: 1814400,
		label: "21d"
	},
	{
		id: "30d",
		sec: 2592e3,
		label: "30d"
	}
];
function cellKey(freq, lb) {
	return `${freq}|${lb}`;
}
function freqFromSec(sec) {
	let best = "1m";
	let dist = Infinity;
	for (const f of HEDGE_FREQS) {
		const d = Math.abs(f.sec - sec);
		if (d < dist) {
			dist = d;
			best = f.id;
		}
	}
	return best;
}
function secFromFreq(id) {
	return HEDGE_FREQS.find((f) => f.id === id)?.sec ?? 60;
}
function formatInterval(sec) {
	if (sec < 60) return `${sec}s`;
	if (sec % 86400 === 0) return `${sec / 86400}d`;
	if (sec % 3600 === 0) return `${sec / 3600}h`;
	if (sec % 60 === 0) return `${sec / 60}m`;
	return `${sec}s`;
}
function snapInterval(sec) {
	const allowed = [...CHECK_INTERVALS.map((x) => x.sec), ...HEDGE_FREQS.map((f) => f.sec)];
	let best = allowed[0] ?? 5;
	let dist = Infinity;
	for (const s of allowed) {
		const d = Math.abs(s - sec);
		if (d < dist) {
			dist = d;
			best = s;
		}
	}
	return best;
}
function resample(bars, bucketSec) {
	if (!bars.length) return [];
	const out = [];
	let bucket = -1;
	let cur = null;
	for (const b of bars) {
		const k = Math.floor(b.t / bucketSec);
		if (k !== bucket) {
			if (cur) out.push(cur);
			bucket = k;
			cur = {
				t: k * bucketSec,
				o: b.o,
				h: b.h,
				l: b.l,
				c: b.c
			};
		} else if (cur) {
			cur.h = Math.max(cur.h, b.h);
			cur.l = Math.min(cur.l, b.l);
			cur.c = b.c;
		}
	}
	if (cur) out.push(cur);
	return out;
}
function closeToClose(bars, dtSec) {
	let ss = 0;
	let n = 0;
	for (let i = 1; i < bars.length; i++) {
		const a = bars[i - 1].c;
		const b = bars[i].c;
		if (a > 0 && b > 0) {
			const r = Math.log(b / a);
			ss += r * r;
			n += 1;
		}
	}
	if (n < 8) return null;
	const ppy = 31536e3 / dtSec;
	return Math.sqrt(ss / n * ppy) * 100;
}
function parkinson(bars, dtSec) {
	let ss = 0;
	let n = 0;
	const den = 4 * Math.log(2);
	for (const b of bars) if (b.h > 0 && b.l > 0 && b.h >= b.l) {
		const x = Math.log(b.h / b.l);
		ss += x * x / den;
		n += 1;
	}
	if (n < 8) return null;
	const ppy = 31536e3 / dtSec;
	return Math.sqrt(ss / n * ppy) * 100;
}
function compositeRv(bars, dtSec) {
	const cc = closeToClose(bars, dtSec);
	const pk = parkinson(bars, dtSec);
	if (cc === null && pk === null) return null;
	if (cc === null) return pk;
	if (pk === null) return cc;
	return (cc + pk) / 2;
}
function buildSurface(currency, bars, asOf) {
	const sorted = [...bars].sort((a, b) => a.t - b.t);
	const coverageSec = sorted.length ? sorted[sorted.length - 1].t - sorted[0].t : 0;
	const cells = {};
	const bestByLookback = {};
	const vals = [];
	for (const lb of LOOKBACKS) {
		const window = sorted.filter((b) => b.t >= asOf - lb.sec);
		for (const freq of HEDGE_FREQS) {
			const sampled = resample(window, freq.sec);
			const span = sampled.length > 1 ? sampled[sampled.length - 1].t - sampled[0].t : 0;
			const impliedDt = sampled.length > 1 ? span / (sampled.length - 1) : Infinity;
			const need = Math.max(10, Math.floor(lb.sec / freq.sec) * .55);
			let rv = null;
			if (sampled.length >= need && impliedDt <= freq.sec * 2.2) rv = compositeRv(sampled, freq.sec);
			cells[cellKey(freq.id, lb.id)] = rv;
			if (rv !== null) vals.push(rv);
		}
		bestByLookback[lb.id] = minRvForLookback({ cells }, lb.id);
	}
	return {
		currency,
		cells,
		min: vals.length ? Math.min(...vals) : 30,
		max: vals.length ? Math.max(...vals) : 50,
		bestByLookback,
		asOf,
		coverageSec
	};
}
function minRvForLookback(surface, lb) {
	let best = null;
	for (const freq of HEDGE_FREQS) {
		const rv = surface.cells[cellKey(freq.id, lb)];
		if (typeof rv === "number" && Number.isFinite(rv) && (!best || rv < best.rv)) best = {
			freqId: freq.id,
			rv
		};
	}
	return best;
}
function emptySurface(currency) {
	const cells = {};
	const bestByLookback = {};
	for (const lb of LOOKBACKS) {
		bestByLookback[lb.id] = null;
		for (const f of HEDGE_FREQS) cells[cellKey(f.id, lb.id)] = null;
	}
	return {
		currency,
		cells,
		min: 30,
		max: 50,
		bestByLookback,
		asOf: 0,
		coverageSec: 0
	};
}
//#endregion
export { parseOptionInstrument as A, isKeelLabel as C, mean as D, makerPrice as E, snapInterval as F, splitNotional as I, sumGreeks as L, rms as M, roundTick as N, minRvForLookback as O, secFromFreq as P, includedPositions as S, makeLabel as T, emptySurface as _, LOOKBACKS as a, freqFromSec as b, buildSurface as c, clamp as d, ddhCurrent as f, deviationDelta as g, ddhThresholds as h, HEDGE_FREQS as i, randn as j, mulberry32 as k, captureBps as l, ddhHedgeUsd as m, CURRENCIES as n, PERP as o, ddhFire as p, DEFAULT_CONFIG as r, blackScholes as s, CHECK_INTERVALS as t, cellKey as u, floorTo as v, labelPrefix as w, hedgeInstrument as x, formatInterval as y };
