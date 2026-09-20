import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { a as getServerFnById, i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware-DMJwzugt.mjs";
import { a as hasGateSessionMarker, t as GROK_PROVIDERS } from "./server-B4OakpBB.mjs";
import { authClient, signIn, signOut } from "./client-B9PiQ-1K.mjs";
import { L as sumGreeks, O as minRvForLookback, S as includedPositions, a as LOOKBACKS, b as freqFromSec, f as ddhCurrent, g as deviationDelta, h as ddhThresholds, i as HEDGE_FREQS, o as PERP, t as CHECK_INTERVALS, u as cellKey, y as formatInterval } from "./rv-Buo_bNNw.mjs";
import { t as Button } from "./button-Cj_Drkos.mjs";
import { a as KeyRound, c as Bell, i as ShieldAlert, l as BellOff, o as ChevronDown, r as Square, s as Check, t as X } from "../_libs/lucide-react.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as DialogPortal, i as DialogOverlay, n as DialogClose, o as DialogTitle, r as DialogContent$1, s as DialogTrigger$1, t as Dialog$1 } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { a as SelectItemIndicator, c as SelectTrigger$1, i as SelectItem$1, l as SelectValue$1, n as SelectContent$1, o as SelectItemText, r as SelectIcon, s as SelectPortal, t as Select$1, u as SelectViewport } from "../_libs/@radix-ui/react-select+[...].mjs";
import { n as Tooltip, r as cn } from "./router-C8kQN2Gm.mjs";
import { n as SwitchThumb, t as Switch$1 } from "../_libs/radix-ui__react-switch.mjs";
import { i as Trigger, n as List, r as Root2, t as Content } from "../_libs/radix-ui__react-tabs.mjs";
import { i as SliderTrack, n as SliderRange, r as SliderThumb, t as Slider$1 } from "../_libs/radix-ui__react-slider.mjs";
import { a as XAxis, c as CartesianGrid, d as Bar, f as Cell, i as YAxis, l as ReferenceArea, m as Tooltip$1, n as BarChart, o as Area, p as ResponsiveContainer, r as LineChart, s as Line, t as AreaChart, u as ReferenceLine } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-D3uimbt8.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function resolveSignInGateState(input) {
	if (input.isPending) return "pending";
	return input.hasUser ? "signed_in" : "signed_out";
}
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	const { data, isPending } = authClient.useSession();
	const user = data?.user;
	return {
		user: user ? {
			id: user.id,
			displayName: user.name ?? null,
			primaryEmail: user.email ?? null,
			profileImageUrl: user.image ?? null,
			isDevFallback: false
		} : null,
		isPending
	};
}
/**
* Convenience view of `useCurrentUserState().user` for display (e.g.
* `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
* for redirects/guards use `useCurrentUserState()` and check `isPending`.
*/
function useCurrentUser() {
	return useCurrentUserState().user;
}
var subscribeToNothing = () => () => {};
var noGateSessionOnServer = () => false;
function SignInGate({ children, fallback }) {
	const { user, isPending } = useCurrentUserState();
	const state = resolveSignInGateState({
		isPending,
		hasUser: user !== null
	});
	if (state === "pending") return null;
	if (state === "signed_in") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: fallback ?? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignInButtons, {}) });
}
function SignInButtons() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex w-full max-w-sm flex-col gap-2",
		children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => signIn(p.providerId, { callbackURL: "/" }),
			className: "w-full cursor-pointer rounded-md border border-neutral-300 px-4 py-2 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900",
			children: ["Continue with ", p.label]
		}, p.providerId))
	});
}
/**
* Minimal signed-in identity chip + sign-out. Restyle freely (see the
* `design-ui` skill). Sign-out is only shown when auth is enabled (the
* disabled-auth dev user has nothing to sign out of) and the session is not
* gate-materialized — behind the gate the next request signs the viewer
* straight back in, so a sign-out control there is a broken loop.
*/
function UserButton() {
	const user = useCurrentUser();
	const [signingOut, setSigningOut] = (0, import_react.useState)(false);
	const gateSession = (0, import_react.useSyncExternalStore)(subscribeToNothing, hasGateSessionMarker, noGateSessionOnServer);
	if (!user) return null;
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: user.profileImageUrl,
				alt: "",
				className: "h-8 w-8 rounded-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20",
				children: label.charAt(0).toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium",
				children: label
			}),
			!gateSession && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: signingOut,
				onClick: () => {
					setSigningOut(true);
					signOut().catch(() => setSigningOut(false));
				},
				className: "cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline disabled:cursor-wait disabled:no-underline",
				children: signingOut ? "Signing out…" : "Sign out"
			})
		]
	});
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var getSnapshot = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("db95fcd0cb61cf78ed13aa6377cdc9f0050cfcc2b7371f918b951eceb798ca2c"));
var connectVenue = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("baa77a2a29e7975201822e109fecf276998c05ad9efe9e6c46a1bbebdc78fd03"));
var disconnectVenue = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("cbb0a7d7574f3fee5bd11d195214f7d1f7a8cc99c295f1b8f1610149c9eca6fe"));
var updateConfig = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("e7ed75642f19d26b5fabe3ebbfa6109fc8b4c6787bb7235fde47164f42604d5e"));
var resetConfig = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("7d842c5a25efc1e81850ae40722de12ef3ff142ddcac3cbce3b689649f4c4f55"));
var armEngine = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input = {}) => input).handler(createSsrRpc("cedbbe2e6fbae691f34475cabdfe59064f8fbb50a8c0215db9db1b480560dc40"));
var disarmEngine = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("7e37b77f9f627178fe32fc44187db2884de69abe95db15c396e41f8549002b18"));
var killEngine = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("9e1703418daee024800343dbabbd508090cd49772a21e3aee43fd643a3006682"));
var tickEngine = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("2ba47c8127c46c4a035eced5e4e0c17b7102e3c2374dc00e930ea0794003c070"));
var runCoach = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("d1a51cf82e77f98fe0ea0210af8521a41152d9f83a41b99334afd56fce1fee97"));
var setVenue = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("721b0157dab8ddf0bd393a03d5f0efd2fc1206636ae48b070712ff7b9a8f7978"));
var selectRvCell = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("4d2099d8d943a37aff264f65a29ec63696beed95aee36a8413d9e6341bf353f3"));
var refreshRvSurface = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("ee48770a97f1c7da526c174131e0f16b38b2e148f17a85a59cd20b928ebea3f2"));
var ackAlerts = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input = {}) => input).handler(createSsrRpc("f8e2bae8419e7d8f5bd10b7c4ca0da1afd579e26808d7741dedda0219b4c6738"));
var testAlert = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("0519508bc10c288cf6f51c6c6b55905b8c171d956ee8f4127464652fcb719c15"));
var tripFailsafe = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("a765fee8d0589552a0be431ba2bb53984c3ae6fafc623b4457d47c6cd8cfbdf6"));
var setWebhook = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("7279d7f200e339255db912ac03c7c8a8aa7310b9b634fc7cdc2a5cb641402c29"));
function Card({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]", className),
		...props
	});
}
function CardHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("mb-3 flex items-center justify-between gap-3", className),
		...props
	});
}
function CardTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
		className: cn("text-[11px] font-medium uppercase tracking-[0.16em] text-subtle", className),
		...props
	});
}
var Dialog = Dialog$1;
var DialogTrigger = DialogTrigger$1;
function DialogContent({ className, children, title }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "fixed inset-0 z-50 bg-bg/70" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
		className: cn("fixed left-1/2 top-1/2 z-50 w-[min(100%-1.5rem,440px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.10)]", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-4 flex items-center justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
				className: "text-base font-medium tracking-tight",
				children: title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogClose, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					size: "icon",
					className: "size-9",
					"aria-label": "Close",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {})
				})
			})]
		}), children]
	})] });
}
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		className: cn("flex h-11 w-full rounded-md bg-surface-2 px-3 text-sm text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)] outline-none transition-[box-shadow] duration-150 placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring font-mono", className),
		...props
	});
}
function Label({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
		className: cn("text-[11px] font-medium uppercase tracking-[0.14em] text-subtle", className),
		...props
	});
}
function Badge({ className, tone = "neutral", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide", {
			neutral: "bg-surface-2 text-fg",
			long: "bg-long/15 text-long",
			short: "bg-short/15 text-short",
			warn: "bg-warn/15 text-warn",
			muted: "bg-surface-2 text-muted"
		}[tone], className),
		...props
	});
}
function Switch({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch$1, {
		className: cn("peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-surface-2 shadow-[0_0_0_1px_rgba(255,255,255,0.10)] transition-colors data-[state=checked]:bg-accent", className),
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, { className: "pointer-events-none block size-5 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-accent-fg" })
	});
}
var Tabs = Root2;
function TabsList({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, {
		className: cn("inline-flex h-11 items-center gap-1 rounded-lg bg-surface-2 p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]", className),
		...props
	});
}
function TabsTrigger({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trigger, {
		className: cn("inline-flex h-9 items-center justify-center rounded-md px-3 text-xs font-medium text-muted transition-colors data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]", className),
		...props
	});
}
var TabsContent = Content;
function Slider({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Slider$1, {
		className: cn("relative flex w-full touch-none select-none items-center", className),
		...props,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderTrack, {
			className: "relative h-1.5 w-full grow overflow-hidden rounded-full bg-surface-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderRange, { className: "absolute h-full bg-accent" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderThumb, { className: "block size-4 rounded-full bg-accent shadow-[0_0_0_1px_rgba(255,255,255,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" })]
	});
}
function Separator({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("h-px w-full bg-border", className),
		...props
	});
}
var Select = Select$1;
var SelectValue = SelectValue$1;
function SelectTrigger({ className, children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectTrigger$1, {
		className: cn("flex h-11 w-full items-center justify-between rounded-md bg-surface-2 px-3 text-sm text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)] outline-none focus-visible:ring-2 focus-visible:ring-ring", className),
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectIcon, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-muted" }) })]
	});
}
function SelectContent({ className, children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectPortal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent$1, {
		className: cn("z-50 overflow-hidden rounded-md bg-surface-2 shadow-[0_0_0_1px_rgba(255,255,255,0.10)]", className),
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectViewport, {
			className: "p-1",
			children
		})
	}) });
}
function SelectItem({ className, children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectItem$1, {
		className: cn("relative flex h-9 cursor-pointer select-none items-center rounded-sm px-8 text-sm text-fg outline-none data-[highlighted]:bg-surface", className),
		...props,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItemIndicator, {
			className: "absolute left-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItemText, { children })]
	});
}
function fmtNum(n, digits = 2) {
	if (!Number.isFinite(n)) return "—";
	return (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("en-US", {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	});
}
function fmtDelta(n) {
	return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(4)}`;
}
function fmtUsd(n, digits = 0) {
	return `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", {
		maximumFractionDigits: digits,
		minimumFractionDigits: digits
	})}`;
}
function fmtBps(n) {
	return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)} bp`;
}
function fmtTime(t) {
	return new Date(t).toLocaleTimeString("en-GB", { hour12: false });
}
function fmtPct(n, digits = 1) {
	if (!Number.isFinite(n)) return "—";
	return `${n.toFixed(digits)}%`;
}
function signedClass(n) {
	if (n > 1e-8) return "text-long";
	if (n < -1e-8) return "text-short";
	return "text-muted";
}
var axis$1 = {
	fontSize: 11,
	fill: "var(--color-subtle)",
	fontFamily: "var(--font-mono)"
};
var grid$1 = { stroke: "color-mix(in oklab, var(--color-fg) 8%, transparent)" };
function ChartTip({ active, payload, label, labels, formats }) {
	if (!active || !payload?.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-md bg-surface-2 px-2.5 py-2 text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.1)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-1 font-mono text-subtle",
			children: typeof label === "number" ? fmtTime(label) : label
		}), payload.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex justify-between gap-4 font-mono",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-muted",
				children: labels?.[p.name] ?? p.name
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-fg",
				children: (formats?.[p.name] ?? ((v) => fmtNum(v, 3)))(Number(p.value))
			})]
		}, p.name))]
	});
}
function DdhDeltaChart({ series, ccy, target, thresholdPos, thresholdNeg, hedges }) {
	const data = series.map((p) => ({
		t: p.t,
		delta: ccy === "BTC" ? p.btcDelta : p.ethDelta,
		perp: ccy === "BTC" ? p.btcIndex : p.ethIndex
	}));
	if (!data.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-64 items-center justify-center text-sm text-muted md:h-72",
		children: "Warming marks…"
	});
	const lo = target - thresholdNeg;
	const hi = target + thresholdPos;
	const marks = (hedges ?? []).slice(0, 24);
	const pxDigits = ccy === "BTC" ? 0 : 1;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-64 w-full md:h-72",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(LineChart, {
			data,
			margin: {
				top: 8,
				right: 4,
				left: 0,
				bottom: 0
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
					strokeDasharray: "3 3",
					stroke: grid$1.stroke
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
					dataKey: "t",
					tickFormatter: fmtTime,
					tick: axis$1,
					minTickGap: 48
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
					yAxisId: "delta",
					tick: axis$1,
					tickFormatter: (v) => fmtNum(v, 2),
					width: 56,
					domain: ["auto", "auto"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
					yAxisId: "perp",
					orientation: "right",
					tick: axis$1,
					tickFormatter: (v) => fmtNum(v, pxDigits),
					width: 64,
					domain: ["auto", "auto"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip$1, { content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartTip, {
					labels: {
						delta: "Δ Total",
						perp: `${ccy}-PERP`
					},
					formats: {
						delta: (v) => fmtNum(v, 3),
						perp: (v) => fmtUsd(v, pxDigits)
					}
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReferenceArea, {
					yAxisId: "delta",
					y1: lo,
					y2: hi,
					fill: "var(--color-long)",
					fillOpacity: .06,
					ifOverflow: "extendDomain"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReferenceLine, {
					yAxisId: "delta",
					y: target,
					stroke: "var(--color-muted)",
					strokeDasharray: "4 4"
				}),
				marks.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReferenceLine, {
					yAxisId: "delta",
					x: t,
					stroke: "var(--color-border)",
					strokeDasharray: "2 4"
				}, t)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
					yAxisId: "delta",
					type: "monotone",
					dataKey: "delta",
					stroke: ccy === "BTC" ? "var(--color-btc)" : "var(--color-eth)",
					dot: false,
					strokeWidth: 1.8,
					isAnimationActive: false
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
					yAxisId: "perp",
					type: "monotone",
					dataKey: "perp",
					stroke: "var(--color-warn)",
					dot: false,
					strokeWidth: 1.4,
					strokeDasharray: "5 3",
					isAnimationActive: false
				})
			]
		}) })
	});
}
function IntervalBars({ rows }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-44 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
			data: rows,
			margin: {
				top: 8,
				right: 8,
				left: 0,
				bottom: 0
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
					strokeDasharray: "3 3",
					stroke: grid$1.stroke
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
					dataKey: "intervalSec",
					tick: axis$1,
					tickFormatter: (v) => `${v}s`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
					yAxisId: "l",
					tick: axis$1,
					tickFormatter: (v) => fmtUsd(v),
					width: 56
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
					yAxisId: "r",
					orientation: "right",
					tick: axis$1,
					width: 48
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip$1, { content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartTip, { labels: {
					estCostUsd: "Est. cost $",
					residualRms: "Residual RMS"
				} }) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
					yAxisId: "l",
					dataKey: "estCostUsd",
					fill: "var(--color-muted)",
					isAnimationActive: false,
					radius: [
						3,
						3,
						0,
						0
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
					yAxisId: "r",
					dataKey: "residualRms",
					fill: "var(--color-eth)",
					isAnimationActive: false,
					radius: [
						3,
						3,
						0,
						0
					]
				})
			]
		}) })
	});
}
function BookLadder({ book }) {
	if (!book) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "py-8 text-center text-sm text-muted",
		children: "No book yet."
	});
	const spread = book.bestAsk - book.bestBid;
	const spreadBps = book.mid ? spread / book.mid * 1e4 : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "font-mono text-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-3 flex items-end justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[11px] uppercase tracking-[0.14em] text-subtle",
				children: "Mid"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xl tabular-nums",
				children: fmtNum(book.mid, 2)
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-right",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[11px] uppercase tracking-[0.14em] text-subtle",
					children: "Spread"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "tabular-nums text-muted",
					children: [
						fmtNum(spread, 2),
						" · ",
						fmtBps(spreadBps)
					]
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg bg-long/10 px-3 py-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[11px] uppercase tracking-[0.14em] text-long",
						children: "Bid"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1 text-lg tabular-nums text-long",
						children: fmtNum(book.bestBid, 2)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-muted tabular-nums",
						children: fmtUsd(book.bidSize)
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg bg-short/10 px-3 py-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[11px] uppercase tracking-[0.14em] text-short",
						children: "Ask"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1 text-lg tabular-nums text-short",
						children: fmtNum(book.bestAsk, 2)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-muted tabular-nums",
						children: fmtUsd(book.askSize)
					})
				]
			})]
		})]
	});
}
function ScoreRing({ quality }) {
	const score = Math.round(quality.score);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-end justify-between gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[11px] uppercase tracking-[0.16em] text-subtle",
				children: "Hedge quality"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 font-mono text-4xl tabular-nums tracking-tight",
				children: quality.n ? score : "—"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-xs text-muted",
				children: [quality.n, " completed cycles"]
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-subtle",
					children: "Fill"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "tabular-nums text-right",
					children: [(quality.fill * 100).toFixed(0), "%"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-subtle",
					children: "Capture"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular-nums text-right",
					children: fmtBps(quality.capture)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-subtle",
					children: "Residual"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular-nums text-right",
					children: fmtNum(quality.residual, 3)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-subtle",
					children: "Adverse"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular-nums text-right",
					children: fmtBps(quality.adverse)
				})
			]
		})]
	});
}
var ANN = 31536e3;
function fillPath(cycles) {
	const done = [...cycles].filter((c) => c.endedAt).sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0));
	let cum = 0;
	return done.map((c) => {
		cum += Math.abs(c.filledUsd);
		return {
			t: c.endedAt ?? c.startedAt,
			label: `${c.currency[0]}${c.id}`,
			ccy: c.currency,
			fill: c.fillRate * 100,
			capture: c.captureBps ?? 0,
			adverse: c.adverseBps ?? 0,
			filledUsd: c.filledUsd,
			residual: c.endDelta ?? 0,
			cumUsd: cum,
			startDelta: c.startDelta
		};
	});
}
function captureHist(cycles, width = 1) {
	const xs = cycles.map((c) => c.captureBps).filter((x) => x !== null && Number.isFinite(x));
	const lo = -8;
	const hi = 8;
	const bins = [];
	for (let e = lo; e < hi; e += width) bins.push({
		x: `${e > 0 ? "+" : ""}${e}`,
		n: 0,
		lo: e
	});
	for (const v of xs) {
		const clamped = Math.min(hi - width, Math.max(lo, v));
		const b = bins[Math.floor((clamped - lo) / width)];
		if (b) b.n += 1;
	}
	return bins;
}
function medianDt(ts) {
	if (ts.length < 2) return 2;
	const dts = [];
	for (let i = 1; i < ts.length; i++) dts.push((ts[i] - ts[i - 1]) / 1e3);
	dts.sort((a, b) => a - b);
	return Math.max(1, dts[Math.floor(dts.length / 2)] ?? 2);
}
function ccRvFromPrices(px, dtSec) {
	if (px.length < 8) return null;
	let ss = 0;
	let n = 0;
	for (let i = 1; i < px.length; i++) {
		const a = px[i - 1];
		const b = px[i];
		if (a > 0 && b > 0) {
			const r = Math.log(b / a);
			ss += r * r;
			n += 1;
		}
	}
	if (n < 6) return null;
	return Math.sqrt(ss / n * (ANN / dtSec)) * 100;
}
function resampleCloses(series, key, bucketSec) {
	const out = [];
	let bucket = -1;
	for (const p of series) {
		const px = p[key];
		if (!(px > 0)) continue;
		const k = Math.floor(p.t / 1e3 / bucketSec);
		if (k !== bucket) {
			out.push({
				t: k * bucketSec,
				c: px
			});
			bucket = k;
		} else if (out.length) out[out.length - 1].c = px;
	}
	return out;
}
function sessionRvAtFreq(series, freqSec) {
	const btcBars = resampleCloses(series, "btcIndex", freqSec);
	const ethBars = resampleCloses(series, "ethIndex", freqSec);
	const nativeDt = medianDt(series.map((p) => p.t));
	const btcFreq = ccRvFromPrices(btcBars.map((b) => b.c), freqSec);
	const ethFreq = ccRvFromPrices(ethBars.map((b) => b.c), freqSec);
	const btcNative = ccRvFromPrices(series.map((p) => p.btcIndex).filter((x) => x > 0), nativeDt);
	const ethNative = ccRvFromPrices(series.map((p) => p.ethIndex).filter((x) => x > 0), nativeDt);
	return {
		btc: btcFreq ?? btcNative,
		eth: ethFreq ?? ethNative,
		atFreq: btcFreq != null && ethFreq != null,
		n: Math.max(btcBars.length, series.length)
	};
}
function rollingIndexRv(series, _freqSec, windowSec = 120) {
	const out = [];
	if (series.length < 10) return out;
	for (let i = 9; i < series.length; i++) {
		const t0 = series[i].t - windowSec * 1e3;
		const slice = series.filter((p) => p.t >= t0 && p.t <= series[i].t);
		if (slice.length < 8) continue;
		const dt = medianDt(slice.map((s) => s.t));
		out.push({
			t: series[i].t,
			btc: ccRvFromPrices(slice.map((s) => s.btcIndex), dt),
			eth: ccRvFromPrices(slice.map((s) => s.ethIndex), dt)
		});
	}
	return out;
}
function diffs(xs) {
	const out = [];
	for (let i = 1; i < xs.length; i++) out.push(xs[i] - xs[i - 1]);
	return out;
}
function rms(xs) {
	if (!xs.length) return 0;
	return Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length);
}
function pathVol(series) {
	const naked = diffs(series.map((p) => p.unhedgedUsd));
	const hedged = diffs(series.map((p) => p.hedgedUsd));
	const nRms = rms(naked);
	const hRms = rms(hedged);
	return {
		nakedRms: nRms,
		hedgedRms: hRms,
		reduction: nRms > 1e-9 ? (1 - hRms / nRms) * 100 : null
	};
}
function rollingPathVol(series, window = 40) {
	const out = [];
	if (series.length < 8) return out;
	for (let i = 8; i < series.length; i++) {
		const v = pathVol(series.slice(Math.max(0, i - window), i + 1));
		out.push({
			t: series[i].t,
			naked: v.nakedRms,
			hedged: v.hedgedRms
		});
	}
	return out;
}
function surfaceCell(surface, freq, lookback) {
	if (!surface) return null;
	const v = surface.cells[cellKey(freq, lookback)];
	return typeof v === "number" ? v : null;
}
function hedgeRvSummary(series, intervalSec, rv, lookback) {
	const freq = freqFromSec(intervalSec);
	const session = sessionRvAtFreq(series, intervalSec);
	const vol = pathVol(series);
	return {
		freq,
		sessionBtc: session.btc,
		sessionEth: session.eth,
		atFreq: session.atFreq,
		surfaceBtc: surfaceCell(rv?.BTC, freq, lookback),
		surfaceEth: surfaceCell(rv?.ETH, freq, lookback),
		nakedRms: vol.nakedRms,
		hedgedRms: vol.hedgedRms,
		reduction: vol.reduction,
		samples: session.n
	};
}
var axis = {
	fontSize: 11,
	fill: "var(--color-subtle)",
	fontFamily: "var(--font-mono)"
};
var grid = { stroke: "color-mix(in oklab, var(--color-fg) 8%, transparent)" };
function Tip({ active, payload, label, labels, format }) {
	if (!active || !payload?.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-md bg-surface-2 px-2.5 py-2 text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.1)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-1 font-mono text-subtle",
			children: typeof label === "number" ? fmtTime(label) : label
		}), payload.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex justify-between gap-4 font-mono",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-muted",
				children: labels?.[p.name] ?? p.name
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-fg",
				children: format ? format(Number(p.value), p.name) : fmtNum(Number(p.value), 2)
			})]
		}, p.name))]
	});
}
function HedgeRvStrip({ snap }) {
	const s = hedgeRvSummary(snap.series, snap.config.intervalSec, snap.rv, snap.config.targetLookback);
	const items = [
		{
			k: s.atFreq ? `BTC RV @ ${s.freq}` : "BTC session RV",
			v: s.sessionBtc == null ? "—" : fmtPct(s.sessionBtc),
			sub: s.surfaceBtc == null ? "path" : `surface ${fmtPct(s.surfaceBtc)}`
		},
		{
			k: s.atFreq ? `ETH RV @ ${s.freq}` : "ETH session RV",
			v: s.sessionEth == null ? "—" : fmtPct(s.sessionEth),
			sub: s.surfaceEth == null ? "path" : `surface ${fmtPct(s.surfaceEth)}`
		},
		{
			k: "Naked $ rms",
			v: fmtUsd(s.nakedRms, 0),
			sub: "unhedged path"
		},
		{
			k: "Hedged $ rms",
			v: fmtUsd(s.hedgedRms, 0),
			sub: "after perps"
		},
		{
			k: "Vol taken out",
			v: s.reduction == null ? "—" : fmtPct(s.reduction, 0),
			sub: `${s.samples} buckets`
		},
		{
			k: "Hedge ratio",
			v: `${snap.config.hedgePct}%`,
			sub: "of Δ − Δ*"
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6",
		children: items.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-xl bg-surface px-3 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[11px] uppercase tracking-[0.14em] text-subtle",
					children: it.k
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 font-mono text-xl tabular-nums",
					children: it.v
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-mono text-[11px] text-muted",
					children: it.sub
				})
			]
		}, it.k))
	});
}
function SessionRvChart({ snap }) {
	const data = rollingIndexRv(snap.series, snap.config.intervalSec);
	const freq = freqFromSec(snap.config.intervalSec);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-52 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(LineChart, {
			data,
			margin: {
				top: 8,
				right: 8,
				left: 0,
				bottom: 0
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
					strokeDasharray: "3 3",
					stroke: grid.stroke
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
					dataKey: "t",
					tickFormatter: fmtTime,
					tick: axis,
					minTickGap: 48
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
					tick: axis,
					tickFormatter: (v) => `${fmtNum(v, 0)}%`,
					width: 48
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip$1, { content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, {
					labels: {
						btc: `BTC ${freq}`,
						eth: `ETH ${freq}`
					},
					format: (n) => fmtPct(n)
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
					type: "monotone",
					dataKey: "btc",
					stroke: "var(--color-btc)",
					dot: false,
					strokeWidth: 1.6,
					isAnimationActive: false
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
					type: "monotone",
					dataKey: "eth",
					stroke: "var(--color-eth)",
					dot: false,
					strokeWidth: 1.6,
					isAnimationActive: false
				})
			]
		}) })
	});
}
function PathVolChart({ series }) {
	const data = rollingPathVol(series);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-52 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
			data,
			margin: {
				top: 8,
				right: 8,
				left: 0,
				bottom: 0
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
					strokeDasharray: "3 3",
					stroke: grid.stroke
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
					dataKey: "t",
					tickFormatter: fmtTime,
					tick: axis,
					minTickGap: 48
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
					tick: axis,
					tickFormatter: (v) => fmtUsd(v),
					width: 56
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip$1, { content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, {
					labels: {
						naked: "Naked $ rms",
						hedged: "Hedged $ rms"
					},
					format: (n) => fmtUsd(n, 0)
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
					type: "monotone",
					dataKey: "naked",
					stroke: "var(--color-short)",
					fill: "var(--color-short)",
					fillOpacity: .12,
					isAnimationActive: false
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
					type: "monotone",
					dataKey: "hedged",
					stroke: "var(--color-long)",
					fill: "var(--color-long)",
					fillOpacity: .16,
					isAnimationActive: false
				})
			]
		}) })
	});
}
function FillRateChart({ cycles }) {
	const data = fillPath(cycles);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-52 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(LineChart, {
			data,
			margin: {
				top: 8,
				right: 8,
				left: 0,
				bottom: 0
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
					strokeDasharray: "3 3",
					stroke: grid.stroke
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
					dataKey: "t",
					tickFormatter: fmtTime,
					tick: axis,
					minTickGap: 48
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
					domain: [0, 100],
					tick: axis,
					tickFormatter: (v) => `${v}%`,
					width: 40
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip$1, { content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, {
					labels: { fill: "Fill" },
					format: (n) => `${fmtNum(n, 0)}%`
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
					type: "monotone",
					dataKey: "fill",
					stroke: "var(--color-accent)",
					dot: { r: 2 },
					strokeWidth: 1.6,
					isAnimationActive: false
				})
			]
		}) })
	});
}
function CaptureChart({ cycles }) {
	const data = fillPath(cycles);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-52 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(LineChart, {
			data,
			margin: {
				top: 8,
				right: 8,
				left: 0,
				bottom: 0
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
					strokeDasharray: "3 3",
					stroke: grid.stroke
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
					dataKey: "t",
					tickFormatter: fmtTime,
					tick: axis,
					minTickGap: 48
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
					tick: axis,
					tickFormatter: (v) => `${fmtNum(v, 1)}`,
					width: 44
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip$1, { content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, {
					labels: {
						capture: "Capture",
						adverse: "Adverse"
					},
					format: (n) => fmtBps(n)
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
					type: "monotone",
					dataKey: "capture",
					stroke: "var(--color-long)",
					dot: false,
					strokeWidth: 1.6,
					isAnimationActive: false
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
					type: "monotone",
					dataKey: "adverse",
					stroke: "var(--color-warn)",
					dot: false,
					strokeWidth: 1.4,
					isAnimationActive: false
				})
			]
		}) })
	});
}
function CumFillChart({ cycles }) {
	const data = fillPath(cycles);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-52 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
			data,
			margin: {
				top: 8,
				right: 8,
				left: 0,
				bottom: 0
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
					strokeDasharray: "3 3",
					stroke: grid.stroke
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
					dataKey: "t",
					tickFormatter: fmtTime,
					tick: axis,
					minTickGap: 48
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
					tick: axis,
					tickFormatter: (v) => fmtUsd(v),
					width: 64
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip$1, { content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, {
					labels: {
						cumUsd: "Filled",
						filledUsd: "Cycle"
					},
					format: (n) => fmtUsd(n, 0)
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
					type: "monotone",
					dataKey: "cumUsd",
					stroke: "var(--color-btc)",
					fill: "var(--color-btc)",
					fillOpacity: .14,
					isAnimationActive: false
				})
			]
		}) })
	});
}
function CaptureHist({ cycles }) {
	const data = captureHist(cycles);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-52 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
			data,
			margin: {
				top: 8,
				right: 8,
				left: 0,
				bottom: 0
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
					strokeDasharray: "3 3",
					stroke: grid.stroke
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
					dataKey: "x",
					tick: axis
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
					allowDecimals: false,
					tick: axis,
					width: 32
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip$1, { content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, {
					labels: { n: "Fills" },
					format: (n) => fmtNum(n, 0)
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
					dataKey: "n",
					isAnimationActive: false,
					radius: [
						3,
						3,
						0,
						0
					],
					children: data.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, { fill: d.lo >= 0 ? "var(--color-long)" : "var(--color-short)" }, i))
				})
			]
		}) })
	});
}
function ResidualVsFill({ cycles }) {
	const data = fillPath(cycles);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-52 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(LineChart, {
			data,
			margin: {
				top: 8,
				right: 8,
				left: 0,
				bottom: 0
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
					strokeDasharray: "3 3",
					stroke: grid.stroke
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
					dataKey: "t",
					tickFormatter: fmtTime,
					tick: axis,
					minTickGap: 48
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
					yAxisId: "l",
					tick: axis,
					tickFormatter: (v) => fmtNum(v, 3),
					width: 52
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
					yAxisId: "r",
					orientation: "right",
					tick: axis,
					tickFormatter: (v) => `${v}%`,
					width: 40
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip$1, { content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tip, {
					labels: {
						residual: "Residual Δ",
						fill: "Fill %"
					},
					format: (n, name) => name === "fill" ? `${fmtNum(n, 0)}%` : fmtNum(n, 4)
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
					yAxisId: "l",
					type: "monotone",
					dataKey: "residual",
					stroke: "var(--color-eth)",
					dot: false,
					strokeWidth: 1.5,
					isAnimationActive: false
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
					yAxisId: "r",
					type: "monotone",
					dataKey: "fill",
					stroke: "var(--color-muted)",
					dot: false,
					strokeWidth: 1.2,
					isAnimationActive: false
				})
			]
		}) })
	});
}
function HealthStrip({ snap }) {
	const h = snap.health;
	if (!h) return null;
	const loopAge = h.lastServerAt ? Math.max(0, Math.round((snap.now - h.lastServerAt) / 1e3)) : null;
	const dashAge = h.lastClientAt ? Math.max(0, Math.round((snap.now - h.lastClientAt) / 1e3)) : null;
	const tone = h.status === "ok" ? "long" : h.status === "degraded" ? "warn" : "short";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center gap-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
				tone,
				children: h.status
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
				tone: h.circuit === "closed" ? "muted" : "short",
				children: ["circuit ", h.circuit.replace("_", " ")]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
				tone: h.serverLoop ? "long" : "warn",
				children: ["loop ", h.serverLoop ? loopAge == null ? "on" : `${loopAge}s` : "down"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
				tone: h.dashboardStale ? "warn" : "muted",
				children: ["dash ", dashAge == null ? "—" : `${dashAge}s`]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
				tone: h.stayAlive ? snap.stayAlivePersisted ? "long" : "warn" : "muted",
				children: h.stayAlive ? snap.stayAlivePersisted ? h.lastWakeAt ? `bg ${Math.max(0, Math.round((snap.now - h.lastWakeAt) / 1e3))}s` : "background" : "bg · not stored" : "attended"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
				tone: "muted",
				children: ["idx ", h.indexSource]
			}),
			h.consecutiveFailures > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
				tone: "warn",
				children: ["fails ", h.consecutiveFailures]
			}) : null,
			h.unackedCritical > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
				tone: "short",
				children: [h.unackedCritical, " critical"]
			}) : null
		]
	});
}
function AlertBanner({ snap, setSnap }) {
	const open = snap.alerts.filter((a) => !a.acked && a.severity !== "info");
	const ack = useMutation({
		mutationFn: () => ackAlerts({ data: {} }),
		onSuccess: setSnap
	});
	if (!open.length && !snap.lastError) return null;
	const top = open[0] ?? null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex flex-col gap-2 rounded-lg px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between", top?.severity === "critical" || snap.health.status === "critical" ? "bg-short/10 text-short" : "bg-warn/10 text-warn"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "min-w-0",
			children: [top ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-medium",
				children: top.title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-current/80",
				children: [" — ", top.detail]
			})] }) : snap.lastError, snap.health.dashboardStale ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-1 block text-xs text-warn",
				children: "Dashboard idle — server loop is still hedging."
			}) : null]
		}), open.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "ghost",
			size: "sm",
			className: "shrink-0",
			onClick: () => ack.mutate(),
			children: ["Ack ", open.length]
		}) : null]
	});
}
function AlertsPanel({ snap, setSnap }) {
	const test = useMutation({
		mutationFn: () => testAlert(),
		onSuccess: (s) => {
			setSnap(s);
			toast.message("Test alert fired.");
		},
		onError: (e) => toast.error(e.message)
	});
	const trip = useMutation({
		mutationFn: () => tripFailsafe(),
		onSuccess: (s) => {
			setSnap(s);
			toast.error("Fail-safe tripped. Orders cancelled.");
		},
		onError: (e) => toast.error(e.message)
	});
	const ack = useMutation({
		mutationFn: () => ackAlerts({ data: {} }),
		onSuccess: setSnap
	});
	const perm = typeof Notification !== "undefined" ? Notification.permission : "denied";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Dual tick sources (server loop + this tab), two-pass kill, circuit after 5 failed ticks, watchdog at 20s. Keys never leave server memory. Webhook is HTTPS-only."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "secondary",
						size: "sm",
						onClick: async () => {
							if (typeof Notification === "undefined") {
								toast.error("Desktop alerts are not available in this browser.");
								return;
							}
							const p = await Notification.requestPermission();
							toast.message(p === "granted" ? "Desktop alerts on." : "Desktop alerts blocked.");
						},
						children: [perm === "granted" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellOff, {}), "Desktop alerts"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "secondary",
						size: "sm",
						onClick: () => test.mutate(),
						disabled: test.isPending,
						children: "Test alert"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "danger",
						size: "sm",
						onClick: () => trip.mutate(),
						disabled: trip.isPending,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {}), "Trip fail-safe"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "sm",
						onClick: () => ack.mutate(),
						children: "Ack all"
					})
				]
			}),
			snap.health.cooldownMs > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-warn",
				children: [
					"Circuit cooling ",
					Math.ceil(snap.health.cooldownMs / 1e3),
					"s before re-arm."
				]
			}) : null,
			snap.alerts.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "space-y-2 font-mono text-xs",
				children: snap.alerts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0 text-subtle tabular-nums",
							children: fmtTime(a.t)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("min-w-16 uppercase tracking-wide", a.severity === "critical" && "text-short", a.severity === "warn" && "text-warn", a.severity === "info" && "text-muted"),
							children: a.severity
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: cn("text-fg", a.acked && "text-muted"),
							children: [
								a.title,
								" — ",
								a.detail
							]
						})
					]
				}, a.id))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "py-8 text-center text-sm text-muted",
				children: "No alerts yet. Test alert exercises the notify path."
			})
		]
	});
}
function useAlertNotify(alerts) {
	const seen = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const primed = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		if (!primed.current) {
			for (const a of alerts) seen.current.add(a.id);
			primed.current = true;
			return;
		}
		if (typeof Notification === "undefined") return;
		if (Notification.permission !== "granted") return;
		for (const a of alerts) {
			if (seen.current.has(a.id)) continue;
			seen.current.add(a.id);
			if (a.severity === "info") continue;
			try {
				new Notification(`MCM Δ · ${a.title}`, {
					body: a.detail,
					tag: a.kind
				});
			} catch {}
			if (a.severity === "critical") toast.error(a.title);
			else toast.message(a.title);
		}
	}, [alerts]);
}
function PositionsTable({ rows, hedgeFull, hedgeSkip, onToggle, onFull }) {
	if (!rows.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "No positions." });
	const skip = new Set(hedgeSkip ?? []);
	const full = hedgeFull !== false;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "overflow-x-auto",
		children: [onFull ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-3 flex items-center justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => onFull(!full),
				className: cn("h-9 rounded-md px-3 text-xs font-medium", full ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted"),
				children: "Full positions hedging"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xs text-muted",
				children: "Uncheck a leg to keep its native delta."
			})]
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full min-w-[720px] text-left text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
				className: "text-[11px] uppercase tracking-[0.12em] text-subtle",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
					onToggle ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium",
						children: "Hedge"
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium",
						children: "Instrument"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium",
						children: "Kind"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium text-right",
						children: "Size"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium text-right",
						children: "Δ"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium text-right",
						children: "Γ"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium text-right",
						children: "Vega"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium text-right",
						children: "Mark"
					})
				] })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
				className: "font-mono tabular-nums",
				children: rows.map((p) => {
					const on = full || !skip.has(p.instrument);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-t border-border",
						children: [
							onToggle ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-pressed": on,
									"aria-label": `Hedge ${p.instrument}`,
									onClick: () => onToggle(p.instrument, !on),
									className: cn("inline-flex size-9 items-center justify-center rounded-md", on ? "bg-long/15 text-long" : "bg-surface-2 text-subtle"),
									children: on ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) : null
								})
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2.5 text-fg",
								children: p.instrument
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2.5 text-muted",
								children: p.kind
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: cn("py-2.5 text-right", signedClass(p.size)),
								children: fmtNum(p.size, p.kind === "option" ? 1 : 0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: cn("py-2.5 text-right", signedClass(p.delta)),
								children: fmtDelta(p.delta)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2.5 text-right text-muted",
								children: fmtNum(p.gamma, 5)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2.5 text-right text-muted",
								children: fmtNum(p.vega, 2)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2.5 text-right",
								children: fmtNum(p.mark, 2)
							})
						]
					}, p.instrument);
				})
			})]
		})]
	});
}
function OrdersTable({ rows }) {
	const open = rows.filter((o) => o.state === "open");
	if (!open.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "No resting maker orders." });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "overflow-x-auto",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full min-w-[640px] text-left text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
				className: "text-[11px] uppercase tracking-[0.12em] text-subtle",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium",
						children: "Label"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium",
						children: "Side"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium text-right",
						children: "Price"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium text-right",
						children: "Amount"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium text-right",
						children: "Filled"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium",
						children: "State"
					})
				] })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
				className: "font-mono tabular-nums",
				children: open.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-t border-border",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2.5",
							children: o.label
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: cn("py-2.5 uppercase", o.side === "buy" ? "text-long" : "text-short"),
							children: o.side
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2.5 text-right",
							children: fmtNum(o.price, 2)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2.5 text-right",
							children: fmtUsd(o.amountUsd)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2.5 text-right",
							children: fmtUsd(o.filledUsd)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2.5",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "muted",
								children: o.state
							})
						})
					]
				}, o.id))
			})]
		})
	});
}
function CyclesTable({ rows }) {
	if (!rows.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "No hedge clocks yet. Save and Run to flatten on the interval." });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "overflow-x-auto",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full min-w-[720px] text-left text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
				className: "text-[11px] uppercase tracking-[0.12em] text-subtle",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium",
						children: "#"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium",
						children: "Time"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium",
						children: "Ccy"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium text-right",
						children: "Start Δ"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium text-right",
						children: "End Δ"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium text-right",
						children: "Filled"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium text-right",
						children: "Fill"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "pb-2 font-medium text-right",
						children: "Capture"
					})
				] })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
				className: "font-mono tabular-nums",
				children: rows.slice(0, 40).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-t border-border",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2.5 text-muted",
							children: c.id
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2.5",
							children: fmtTime(c.startedAt)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2.5",
							children: c.currency
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: cn("py-2.5 text-right", signedClass(c.startDelta)),
							children: fmtDelta(c.startDelta)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: cn("py-2.5 text-right", signedClass(c.endDelta ?? 0)),
							children: c.endDelta === null ? "…" : fmtDelta(c.endDelta)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2.5 text-right",
							children: fmtUsd(c.filledUsd)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "py-2.5 text-right",
							children: [(c.fillRate * 100).toFixed(0), "%"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2.5 text-right",
							children: c.captureBps === null ? "—" : fmtBps(c.captureBps)
						})
					]
				}, `${c.currency}-${c.id}`))
			})]
		})
	});
}
function TapeList({ rows }) {
	if (!rows.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "Silent." });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
		className: "space-y-2 font-mono text-xs",
		children: rows.map((e, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "flex gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0 text-subtle tabular-nums",
					children: fmtTime(e.t)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: cn("min-w-10 uppercase tracking-wide", e.level === "fill" && "text-long", e.level === "warn" && "text-warn", e.level === "error" && "text-short", e.level === "policy" && "text-eth", e.level === "info" && "text-muted"),
					children: e.level
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-fg",
					children: e.message
				})
			]
		}, `${e.t}-${i}`))
	});
}
function Empty({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "py-10 text-center text-sm text-muted",
		children
	});
}
function lerp(a, b, t) {
	return a + (b - a) * t;
}
function rvFill(rv, min, max) {
	const t = max <= min ? .5 : Math.min(1, Math.max(0, (rv - min) / (max - min)));
	if (t < .5) {
		const u = t / .5;
		const r = lerp(153, 214, u);
		const g = lerp(27, 178, u);
		const b = lerp(27, 94, u);
		return `rgb(${r.toFixed(0)} ${g.toFixed(0)} ${b.toFixed(0)})`;
	}
	const u = (t - .5) / .5;
	const r = lerp(214, 22, u);
	const g = lerp(178, 128, u);
	const b = lerp(94, 72, u);
	return `rgb(${r.toFixed(0)} ${g.toFixed(0)} ${b.toFixed(0)})`;
}
function ink(rv, min, max) {
	const t = max <= min ? .5 : (rv - min) / (max - min);
	return t > .35 && t < .72 ? "#18181b" : "#f4f4f5";
}
function RvHeatmap({ snap, setSnap }) {
	const [ccy, setCcy] = (0, import_react.useState)("BTC");
	const surface = snap.rv?.[ccy];
	const activeFreq = freqFromSec(snap.config.intervalSec);
	const activeLb = snap.config.targetLookback;
	const best = surface ? minRvForLookback(surface, activeLb) : null;
	const pick = useMutation({
		mutationFn: (cell) => selectRvCell({ data: cell }),
		onSuccess: setSnap,
		onError: (e) => toast.error(e.message)
	});
	const refresh = useMutation({
		mutationFn: () => refreshRvSurface(),
		onSuccess: setSnap
	});
	const policy = useMutation({
		mutationFn: (patch) => updateConfig({ data: patch }),
		onSuccess: setSnap
	});
	const ready = Boolean(surface && surface.asOf);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, {
				className: "flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardTitle, { children: [ccy, " — Composite RV across lookbacks and hedge frequencies"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted",
					children: "Close-to-close × Parkinson, annualized. Click a cell to hedge at that frequency. Red = lower RV."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex rounded-md bg-surface-2 p-0.5",
						children: ["BTC", "ETH"].map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setCcy(c),
							className: cn("h-8 min-w-11 rounded-sm px-2.5 text-xs font-medium", ccy === c ? "bg-surface text-fg" : "text-muted"),
							children: c
						}, c))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "sm",
						onClick: () => refresh.mutate(),
						disabled: refresh.isPending,
						children: refresh.isPending || !ready ? "Loading…" : "Refresh"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex flex-wrap items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted",
						children: "Lookback"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-1",
						children: LOOKBACKS.map((lb) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => policy.mutate({
								freqPolicy: snap.config.freqPolicy,
								targetLookback: lb.id
							}),
							className: cn("h-8 rounded-md px-2 text-xs font-medium", activeLb === lb.id ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted"),
							children: lb.label
						}, lb.id))
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ml-auto flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-right",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted",
							children: "Lock min-RV frequency"
						}), best ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "font-mono text-xs text-fg",
							children: [
								activeLb,
								" → ",
								best.freqId,
								" · ",
								best.rv.toFixed(2),
								"%"
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-subtle",
							children: "waiting on Deribit bars"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: snap.config.freqPolicy === "min_rv",
						onCheckedChange: (v) => policy.mutate({ freqPolicy: v ? "min_rv" : "manual" })
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "-mx-1 overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-[640px] gap-2 px-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex w-6 shrink-0 items-center justify-center",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] uppercase tracking-[0.16em] text-subtle",
							style: {
								writingMode: "vertical-rl",
								transform: "rotate(180deg)"
							},
							children: "Hedging frequency"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-px",
							style: { gridTemplateColumns: `48px repeat(${LOOKBACKS.length}, minmax(64px, 1fr))` },
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {}),
								LOOKBACKS.map((lb) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: cn("pb-1 text-center text-[11px] uppercase tracking-[0.12em] text-subtle", lb.id === activeLb && "text-fg"),
									children: lb.label
								}, lb.id)),
								HEDGE_FREQS.map((freq) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FreqRow, {
									freq: freq.id,
									surface,
									activeFreq,
									activeLb,
									bestFreq: best?.freqId ?? null,
									onPick: (lookbackId) => pick.mutate({
										freqId: freq.id,
										lookbackId
									})
								}, freq.id))
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-subtle",
								children: "Lookback window"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegendBar, {
								min: surface?.min ?? 31,
								max: surface?.max ?? 48
							})]
						})]
					})]
				})
			})
		]
	});
}
function FreqRow({ freq, surface, activeFreq, activeLb, bestFreq, onPick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex items-center pr-2 text-right text-[11px] uppercase tracking-[0.08em] text-subtle", freq === activeFreq && "font-medium text-fg"),
		children: freq
	}), LOOKBACKS.map((lb) => {
		const rv = surface?.cells[cellKey(freq, lb.id)] ?? null;
		const selected = freq === activeFreq && lb.id === activeLb;
		const champ = freq === bestFreq && lb.id === activeLb;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			disabled: rv === null,
			onClick: () => onPick(lb.id),
			className: cn("flex h-11 items-center justify-center rounded-sm font-mono text-xs tabular-nums transition-[filter,box-shadow] duration-150", rv === null ? "bg-surface-2 text-subtle" : "hover:brightness-110", selected && "ring-2 ring-fg", champ && !selected && "ring-1 ring-accent"),
			style: rv !== null && surface ? {
				background: rvFill(rv, surface.min, surface.max),
				color: ink(rv, surface.min, surface.max)
			} : void 0,
			children: rv === null ? "—" : rv.toFixed(2)
		}, lb.id);
	})] });
}
function LegendBar({ min, max }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-[10px] text-subtle",
				children: min.toFixed(0)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-3 w-28 rounded-sm",
				style: { background: `linear-gradient(to right, ${rvFill(min, min, max)}, ${rvFill((min + max) / 2, min, max)}, ${rvFill(max, min, max)})` }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "font-mono text-[10px] text-subtle",
				children: [max.toFixed(0), " Ann. RV %"]
			})
		]
	});
}
function ActiveFreqBadge({ snap }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
		tone: snap.config.freqPolicy === "min_rv" ? "long" : "neutral",
		children: [formatInterval(snap.config.intervalSec), snap.config.freqPolicy === "min_rv" ? ` · ${snap.config.targetLookback}` : ""]
	});
}
var QK = ["keel"];
function ClientOnly({ children, fallback }) {
	const [on, setOn] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => setOn(true), []);
	if (!on) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: fallback ?? null });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
function useKeel(initial) {
	const qc = useQueryClient();
	const user = useCurrentUser();
	const query = useQuery({
		queryKey: [...QK, user?.id ?? "anon"],
		queryFn: () => getSnapshot(),
		refetchInterval: 4e3,
		initialData: initial,
		enabled: Boolean(user?.id)
	});
	const setSnap = (s) => qc.setQueryData([...QK, user?.id ?? "anon"], s);
	(0, import_react.useEffect)(() => {
		if (!user?.id) return;
		tickEngine().then(setSnap).catch(() => {});
		const ms = query.data?.venue === "paper" ? 2e3 : 4e3;
		const id = window.setInterval(() => {
			tickEngine().then(setSnap).catch(() => {});
		}, ms);
		return () => window.clearInterval(id);
	}, [
		query.data?.venue,
		qc,
		user?.id
	]);
	return {
		snap: query.data,
		query,
		setSnap,
		qc
	};
}
function KeelApp({ initial }) {
	const { snap, query, setSnap } = useKeel(initial);
	const [tab, setTab] = (0, import_react.useState)("positions");
	const [ccy, setCcy] = (0, import_react.useState)("BTC");
	useAlertNotify(snap?.alerts ?? []);
	if (query.isLoading && !snap) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-dvh items-center justify-center bg-bg text-muted",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-mono text-sm tracking-wide",
			children: "Loading book…"
		})
	});
	if (query.isError && !snap) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-dvh items-center justify-center bg-bg px-6 text-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-short",
			children: "Could not start the engine. Reload."
		})
	});
	if (!snap) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "keel-grid min-h-dvh bg-bg text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-4 pb-24 md:px-6 md:pb-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, {
					snap,
					setSnap
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HealthStrip, { snap }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertBanner, {
					snap,
					setSnap
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CurrencyBar, {
					ccy,
					onCcy: setCcy,
					snap
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DdhStrip, {
					snap,
					ccy
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardTitle, { children: ["Delta Total · ", ccy] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-xs text-muted",
								children: PERP[ccy]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClientOnly, {
								fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-64" }),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DdhDeltaChart, {
									series: snap.series,
									ccy,
									target: snap.config.deltaUnit === "usd" ? (snap.config.targetDelta[ccy] ?? 0) / Math.max(1, snap.indices[ccy]) : snap.config.targetDelta[ccy] ?? 0,
									thresholdPos: ddhThresholds(snap.config, ccy).pos / (snap.config.deltaUnit === "usd" ? Math.max(1, snap.indices[ccy]) : 1),
									thresholdNeg: ddhThresholds(snap.config, ccy).neg / (snap.config.deltaUnit === "usd" ? Math.max(1, snap.indices[ccy]) : 1),
									hedges: snap.cycles.filter((c) => c.currency === ccy).map((c) => c.startedAt)
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-xs text-muted",
								children: [
									"Left: Δ Total. Right: ",
									ccy,
									"-PERP mark. Shade is the idle band. Vertical ticks are clocks."
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClientOnly, {
						fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Parameters" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-[420px]" })] }),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DdhPanel, {
							snap,
							setSnap,
							ccy
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "min-w-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
							value: tab,
							onValueChange: setTab,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mb-4 flex flex-wrap items-center justify-between gap-3",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
										className: "flex-wrap",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
												value: "positions",
												children: "Positions"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
												value: "orders",
												children: "Orders"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
												value: "cycles",
												children: "Hedges"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
												value: "tape",
												children: "Log"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
												value: "fills",
												children: "Fills"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
												value: "rv",
												children: "RV"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
												value: "alerts",
												children: "Alerts"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
												value: "eval",
												children: "Eval"
											})
										]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
									value: "positions",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PositionsTable, {
										rows: snap.positions.filter((p) => p.currency === ccy),
										hedgeFull: snap.config.hedgeFull,
										hedgeSkip: snap.config.hedgeSkip,
										onToggle: (instrument, include) => {
											const skip = new Set(snap.config.hedgeSkip ?? []);
											if (include) skip.delete(instrument);
											else skip.add(instrument);
											updateConfig({ data: {
												hedgeFull: false,
												hedgeSkip: [...skip]
											} }).then(setSnap);
										},
										onFull: (full) => {
											updateConfig({ data: {
												hedgeFull: full,
												hedgeSkip: full ? [] : snap.config.hedgeSkip
											} }).then(setSnap);
										}
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
									value: "orders",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrdersTable, { rows: snap.orders.filter((o) => o.currency === ccy) })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
									value: "cycles",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CyclesTable, { rows: snap.cycles.filter((c) => c.currency === ccy) })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
									value: "tape",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TapeList, { rows: snap.tape })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
									value: "fills",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FillsTab, { snap })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
									value: "rv",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RvHeatmap, {
										snap,
										setSnap
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
									value: "alerts",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertsPanel, {
										snap,
										setSnap
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
									value: "eval",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EvalPanel, {
										snap,
										setSnap
									})
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Perp book" }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookLadder, { book: snap.books[PERP[ccy]] })] })]
				})
			]
		})
	});
}
function CurrencyBar({ ccy, onCcy, snap }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center justify-between gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex rounded-lg bg-surface-2 p-1",
			children: ["BTC", "ETH"].map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => onCcy(c),
				className: cn("h-11 min-w-16 rounded-md px-4 text-sm font-medium", ccy === c ? "bg-surface text-fg" : "text-muted"),
				children: c
			}, c))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "font-mono text-xs text-muted",
			children: [
				formatInterval(snap.config.intervalSec),
				" · ",
				snap.config.hedgePct,
				"% ·",
				" ",
				snap.config.deltaUnit === "usd" ? "USD" : "coin"
			]
		})]
	});
}
function DdhStrip({ snap, ccy }) {
	const included = includedPositions(snap.positions, snap.config.hedgeFull !== false, snap.config.hedgeSkip ?? []);
	const g = sumGreeks(included, ccy);
	const unit = snap.config.deltaUnit;
	const index = snap.indices[ccy] || 1;
	const target = snap.config.targetDelta[ccy] ?? 0;
	const deltaCoin = snap.venue !== "paper" && snap.config.hedgeFull !== false ? snap.account[ccy]?.deltaTotal ?? g.delta : g.delta;
	const current = ddhCurrent(deltaCoin, index, unit);
	const thr = ddhThresholds(snap.config, ccy);
	const dev = deviationDelta(current, target);
	const outside = Boolean(dev.raw >= thr.pos && dev.raw > 0) || Boolean(-dev.raw >= thr.neg && dev.raw < 0);
	const remain = snap.armed && snap.nextCycleAt ? Math.max(0, snap.nextCycleAt - snap.now) : 0;
	const fmtU = (n) => unit === "usd" ? fmtUsd(n, 0) : fmtDelta(n);
	const items = [
		{
			k: "Δ Total",
			v: fmtDelta(deltaCoin),
			n: deltaCoin,
			sub: unit === "usd" ? fmtUsd(current, 0) : `opt ${fmtDelta(g.optionDelta)}`
		},
		{
			k: "Δ Target",
			v: fmtU(target),
			n: target,
			sub: unit === "usd" ? "USD-based" : "each clock"
		},
		{
			k: "Residual",
			v: fmtU(dev.raw),
			n: dev.raw,
			sub: `± ${fmtU(Math.max(thr.pos, thr.neg))}`
		},
		{
			k: "Band",
			v: outside ? "outside" : "inside",
			n: 0,
			sub: outside ? "hedge on clock" : "clock will skip"
		},
		{
			k: "Clock",
			v: formatInterval(snap.config.intervalSec),
			n: 0,
			sub: snap.config.freqPolicy === "min_rv" ? `min RV ${snap.config.targetLookback}` : "manual"
		},
		{
			k: "Next",
			v: snap.armed ? `${Math.ceil(remain / 1e3)}s` : "off",
			n: 0,
			sub: snap.armed ? "running" : "stopped"
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6",
		children: items.map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-xl bg-surface px-3 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[11px] uppercase tracking-[0.14em] text-subtle",
					children: it.k
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: cn("mt-1 font-mono text-xl tabular-nums", it.k === "Residual" || it.k === "Δ Total" ? signedClass(it.n) : "", it.k === "Band" && outside ? "text-warn" : ""),
					children: it.v
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-mono text-[11px] text-muted",
					children: it.sub
				})
			]
		}, it.k))
	});
}
function Header({ snap, setSnap }) {
	const kill = useMutation({
		mutationFn: () => killEngine(),
		onSuccess: (s) => {
			setSnap(s);
			toast.message("All hedger orders cancelled.");
		},
		onError: (e) => toast.error(e.message)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "flex flex-col gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cn("mt-1 h-10 w-1 shrink-0 rounded-full", snap.armed ? "bg-long" : "bg-border") }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-2xl font-medium tracking-tight",
							children: "MCM Delta Hedger"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: snap.venue === "mainnet" ? "short" : snap.venue === "testnet" ? "warn" : "muted",
							children: snap.venue
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: snap.armed ? "long" : "muted",
							children: snap.armed ? snap.config.stayAlive && snap.stayAlivePersisted ? "Background" : "Running" : "Stopped"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActiveFreqBadge, { snap }),
						snap.connected && snap.clientIdMasked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: "neutral",
							children: snap.clientIdMasked
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "md:ml-auto",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-xl text-sm text-muted",
					children: "Maker-only. Clock first (1m, 1h, …), then hedge only if residual is outside tolerance."
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-end",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConnectDialog, {
				snap,
				setSnap
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "danger",
				onClick: () => kill.mutate(),
				className: "min-h-11 w-full md:w-auto",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, {}), "Kill"]
			})]
		})]
	});
}
function ConnectDialog({ snap, setSnap }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [venue, setVenueLocal] = (0, import_react.useState)(snap.venue);
	const [clientId, setClientId] = (0, import_react.useState)("");
	const [clientSecret, setClientSecret] = (0, import_react.useState)("");
	const [confirmLive, setConfirmLive] = (0, import_react.useState)("");
	const [webhook, setWebhookLocal] = (0, import_react.useState)("");
	const venueMut = useMutation({
		mutationFn: (v) => setVenue({ data: { venue: v } }),
		onSuccess: setSnap
	});
	const connectMut = useMutation({
		mutationFn: () => connectVenue({ data: {
			venue,
			clientId,
			clientSecret,
			webhookUrl: webhook.trim() || void 0
		} }),
		onSuccess: (s) => {
			setSnap(s);
			setClientSecret("");
			setOpen(false);
			toast.message(venue === "paper" ? "Paper venue ready." : `Connected ${venue}.`);
		},
		onError: (e) => toast.error(e.message)
	});
	const disc = useMutation({
		mutationFn: () => disconnectVenue(),
		onSuccess: (s) => {
			setSnap(s);
			toast.message("Dropped live keys. Back on paper.");
		}
	});
	const hookMut = useMutation({
		mutationFn: () => setWebhook({ data: { url: webhook.trim() || null } }),
		onSuccess: (s) => {
			setSnap(s);
			toast.message(s.webhookMasked ? `Webhook ${s.webhookMasked}` : "Webhook cleared.");
		},
		onError: (e) => toast.error(e.message)
	});
	const liveBlocked = venue === "mainnet" && confirmLive !== "LIVE";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, {
		open,
		onOpenChange: setOpen,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
			asChild: true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "outline",
				className: "min-h-11 w-full md:w-auto",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, {}), "Keys"]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			title: "Venue & keys",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-4 text-sm text-muted",
					children: "Keys stay in server memory. Deribit account:read + trade:read_write. Live pulls portfolio delta from the venue. Type LIVE for mainnet."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-4 grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1",
					children: [
						"paper",
						"testnet",
						"mainnet"
					].map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							setVenueLocal(v);
							if (v === "paper") venueMut.mutate(v);
						},
						className: cn("h-9 rounded-md text-xs font-medium capitalize", venue === v ? "bg-surface text-fg" : "text-muted"),
						children: v
					}, v))
				}),
				venue !== "paper" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "cid",
								children: "Client ID"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "cid",
								autoComplete: "off",
								value: clientId,
								onChange: (e) => setClientId(e.target.value),
								spellCheck: false
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "csec",
								children: "Client secret"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "csec",
								type: "password",
								autoComplete: "off",
								value: clientSecret,
								onChange: (e) => setClientSecret(e.target.value)
							})]
						}),
						venue === "mainnet" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "live",
									children: "Type LIVE to enable mainnet"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "live",
									value: confirmLive,
									onChange: (e) => setConfirmLive(e.target.value),
									placeholder: "LIVE"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "flex items-start gap-2 text-xs text-warn",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "mt-0.5 size-3.5 shrink-0" }), "Real orders. Start on testnet."]
								})
							]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "w-full",
							disabled: connectMut.isPending || liveBlocked || !clientId || !clientSecret,
							onClick: () => connectMut.mutate(),
							children: connectMut.isPending ? "Connecting…" : "Connect"
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Paper short-gamma book vs live Deribit index. Save and Run to hedge with simulated maker perps."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 space-y-1.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "hook",
							children: "Alert webhook (optional)"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "hook",
							type: "url",
							autoComplete: "off",
							placeholder: "https://…",
							value: webhook,
							onChange: (e) => setWebhookLocal(e.target.value)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "secondary",
							className: "w-full",
							onClick: () => hookMut.mutate(),
							disabled: hookMut.isPending,
							children: hookMut.isPending ? "Saving…" : "Save webhook"
						})
					]
				}),
				snap.venue !== "paper" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					className: "mt-3 w-full",
					onClick: () => disc.mutate(),
					children: "Drop keys"
				}) : null
			]
		})]
	});
}
function draftKey(c, wantOn) {
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
		wantOn
	});
}
function hedgeChoices(snap, ccy) {
	const set = /* @__PURE__ */ new Set([
		PERP[ccy],
		snap.config.longInstrument?.[ccy] || PERP[ccy],
		snap.config.shortInstrument?.[ccy] || PERP[ccy]
	]);
	for (const k of Object.keys(snap.books)) if (k.startsWith(`${ccy}-`)) set.add(k);
	for (const p of snap.positions) if (p.currency === ccy && p.kind === "future") set.add(p.instrument);
	return [...set];
}
function DdhPanel({ snap, setSnap, ccy }) {
	const [draft, setDraft] = (0, import_react.useState)(snap.config);
	const [wantOn, setWantOn] = (0, import_react.useState)(snap.armed);
	const [armConfirm, setArmConfirm] = (0, import_react.useState)("");
	const [dirty, setDirty] = (0, import_react.useState)(false);
	const [tgtStr, setTgtStr] = (0, import_react.useState)(String(snap.config.targetDelta[ccy] ?? 0));
	(0, import_react.useEffect)(() => {
		if (!dirty) {
			setDraft(snap.config);
			setWantOn(snap.armed);
		}
		setTgtStr(String((dirty ? draft : snap.config).targetDelta[ccy] ?? 0));
	}, [
		snap.config,
		snap.armed,
		dirty,
		ccy
	]);
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
		edition: "pro",
		deltaUnit: draft.deltaUnit,
		longInstrument: draft.longInstrument,
		shortInstrument: draft.shortInstrument,
		orderAmountCoin: draft.orderAmountCoin,
		stayAlive: draft.stayAlive
	});
	const save = useMutation({
		mutationFn: async () => updateConfig({ data: payload() }),
		onSuccess: (s) => {
			setSnap(s);
			setDirty(false);
			toast.message("Parameters saved.");
		},
		onError: (e) => toast.error(e.message)
	});
	const run = useMutation({
		mutationFn: async () => {
			const s1 = await updateConfig({ data: payload() });
			if (!s1.armed) return armEngine({ data: { confirm: snap.venue === "mainnet" ? armConfirm : void 0 } });
			return s1;
		},
		onSuccess: (s) => {
			setSnap(s);
			setDirty(false);
			setWantOn(true);
			setArmConfirm("");
			toast.message("MCM Delta Hedger running.");
		},
		onError: (e) => toast.error(e.message)
	});
	const stop = useMutation({
		mutationFn: () => disarmEngine(),
		onSuccess: (s) => {
			setSnap(s);
			setWantOn(false);
			toast.message("Hedger stopped. Parameters kept.");
		},
		onError: (e) => toast.error(e.message)
	});
	const reset = useMutation({
		mutationFn: () => resetConfig(),
		onSuccess: (s) => {
			setSnap(s);
			setDirty(false);
		}
	});
	const patch = (p) => {
		setDraft((d) => {
			return {
				...d,
				...p,
				edition: "pro",
				threshold: {
					...d.threshold,
					...p.threshold ?? {}
				},
				thresholdPos: {
					...d.thresholdPos,
					...p.thresholdPos ?? {}
				},
				thresholdNeg: {
					...d.thresholdNeg,
					...p.thresholdNeg ?? {}
				},
				targetDelta: {
					...d.targetDelta,
					...p.targetDelta ?? {}
				},
				longInstrument: {
					...d.longInstrument,
					...p.longInstrument ?? {}
				},
				shortInstrument: {
					...d.shortInstrument,
					...p.shortInstrument ?? {}
				},
				orderAmountCoin: {
					...d.orderAmountCoin,
					...p.orderAmountCoin ?? {}
				}
			};
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Parameters" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
		variant: "ghost",
		size: "sm",
		onClick: () => reset.mutate(),
		children: "Defaults"
	})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1",
				children: ["coin", "usd"].map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						if (u === draft.deltaUnit) return;
						const idx = snap.indices[ccy] || 1;
						const scale = u === "usd" ? idx : 1 / idx;
						patch({
							deltaUnit: u,
							targetDelta: {
								...draft.targetDelta,
								[ccy]: (draft.targetDelta[ccy] ?? 0) * scale
							},
							threshold: {
								...draft.threshold,
								[ccy]: draft.threshold[ccy] * scale
							},
							thresholdPos: {
								...draft.thresholdPos,
								[ccy]: (draft.thresholdPos[ccy] ?? draft.threshold[ccy]) * scale
							},
							thresholdNeg: {
								...draft.thresholdNeg,
								[ccy]: (draft.thresholdNeg[ccy] ?? draft.threshold[ccy]) * scale
							}
						});
					},
					className: cn("h-10 rounded-md text-sm font-medium uppercase", draft.deltaUnit === u ? "bg-surface text-fg" : "text-muted"),
					children: u
				}, u))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Hedge every" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono tabular-nums text-muted",
							children: formatInterval(draft.intervalSec)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-1",
						children: CHECK_INTERVALS.slice(0, 7).map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: draft.intervalSec === it.sec ? "default" : "secondary",
							onClick: () => patch({
								intervalSec: it.sec,
								freqPolicy: "manual"
							}),
							children: it.label
						}, it.sec))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-3 pt-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm",
							children: "Lock min RV"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted",
							children: "Clock = lowest-RV cell on the heatmap."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: draft.freqPolicy === "min_rv",
							onCheckedChange: (v) => patch({ freqPolicy: v ? "min_rv" : "manual" })
						})]
					}),
					draft.freqPolicy === "min_rv" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Lookback" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
							value: draft.targetLookback,
							onValueChange: (v) => patch({ targetLookback: v }),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: LOOKBACKS.map((lb) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: lb.id,
								children: lb.label
							}, lb.id)) })]
						})]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, {
						htmlFor: "tgt",
						children: [
							"Delta Target (",
							unit,
							")"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "tgt",
						inputMode: "decimal",
						value: tgtStr,
						onChange: (e) => setTgtStr(e.target.value),
						onBlur: () => {
							const n = Number(tgtStr);
							if (Number.isFinite(n)) patch({ targetDelta: {
								...draft.targetDelta,
								[ccy]: n
							} });
							else setTgtStr(String(target));
						},
						onKeyDown: (e) => {
							if (e.key === "Enter") e.target.blur();
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] text-muted",
						children: "Each clock hedges toward this if outside the band. 0 = flat."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderRow, {
				label: `+ Tolerance (${unit})`,
				value: fmtNum(pos, 3),
				min: ccy === "BTC" ? .01 : .1,
				max: ccy === "BTC" ? unit === "USD" ? 2e5 : 5 : 50,
				step: ccy === "BTC" ? .01 : .1,
				current: pos,
				onCommit: (v) => patch({ thresholdPos: {
					...draft.thresholdPos,
					[ccy]: v
				} }),
				hint: "After the clock: short the hedge contract only if residual ≥ this."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderRow, {
				label: `− Tolerance (${unit})`,
				value: fmtNum(neg, 3),
				min: ccy === "BTC" ? .01 : .1,
				max: ccy === "BTC" ? unit === "USD" ? 2e5 : 5 : 50,
				step: ccy === "BTC" ? .01 : .1,
				current: neg,
				onCommit: (v) => patch({ thresholdNeg: {
					...draft.thresholdNeg,
					[ccy]: v
				} }),
				hint: "After the clock: long the hedge contract only if residual ≤ −this."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Hedging Ratio" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-mono tabular-nums text-muted",
							children: [draft.hedgePct, "%"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-1",
						children: [
							30,
							50,
							100,
							150
						].map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: draft.hedgePct === p ? "default" : "secondary",
							onClick: () => patch({ hedgePct: p }),
							children: [p, "%"]
						}, p))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderRow, {
						label: "Of residual",
						value: `${draft.hedgePct}%`,
						min: 0,
						max: 150,
						step: 5,
						current: draft.hedgePct,
						onCommit: (v) => patch({ hedgePct: v }),
						hint: "Applies only when the clock finds residual outside tolerance. 100% to target. 50% half."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Long contract (buy)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: draft.longInstrument[ccy],
					onValueChange: (v) => patch({ longInstrument: {
						...draft.longInstrument,
						[ccy]: v
					} }),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: choices.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: n,
						children: n
					}, n)) })]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Short contract (sell)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
					value: draft.shortInstrument[ccy],
					onValueChange: (v) => patch({ shortInstrument: {
						...draft.shortInstrument,
						[ccy]: v
					} }),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: choices.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
						value: n,
						children: n
					}, n)) })]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderRow, {
				label: `Each order (${ccy})`,
				value: draft.orderAmountCoin[ccy] ? `${fmtNum(draft.orderAmountCoin[ccy], 2)}` : "full",
				min: 0,
				max: ccy === "BTC" ? 20 : 200,
				step: ccy === "BTC" ? .5 : 5,
				current: draft.orderAmountCoin[ccy] ?? 0,
				onCommit: (v) => patch({ orderAmountCoin: {
					...draft.orderAmountCoin,
					[ccy]: v
				} }),
				hint: "Maker slice size in coin. 0 = one order. Unfilled leftover cancels on the next clock."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm",
					children: "Run in background"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted",
					children: "Required for unattended. Encrypts keys; worker wakes every 1 min and ticks ~45s. Disconnect wipes."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
					checked: draft.stayAlive,
					onCheckedChange: (v) => patch({ stayAlive: v })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm",
					children: "Reject if would take"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted",
					children: "Strict maker. Next clock cancels leftover slices."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
					checked: draft.rejectPostOnly,
					onCheckedChange: (v) => patch({ rejectPostOnly: v })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator, {}),
			needArmWord && !snap.armed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "arm",
					children: "Type ARM for mainnet"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "arm",
					value: armConfirm,
					onChange: (e) => setArmConfirm(e.target.value),
					placeholder: "ARM"
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "secondary",
					disabled: busy || !paramsPending,
					onClick: () => save.mutate(),
					children: save.isPending ? "Saving…" : "Save"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					disabled: busy || snap.venue === "mainnet" && !snap.armed && armConfirm !== "ARM",
					onClick: () => run.mutate(),
					children: run.isPending ? "Starting…" : "Save and Run"
				})]
			}),
			snap.armed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "outline",
				className: "w-full",
				disabled: busy,
				onClick: () => stop.mutate(),
				children: "Switch Off"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] text-muted",
				children: "Save writes parameters only. Save and Run arms the loop. Closing this panel without either does nothing."
			})
		]
	})] });
}
function SliderRow({ label, value, min, max, step, current, onCommit, hint }) {
	const [local, setLocal] = (0, import_react.useState)(current);
	(0, import_react.useEffect)(() => setLocal(current), [current]);
	const body = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono tabular-nums text-muted",
				children: value
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
			min,
			max,
			step,
			value: [local],
			onValueChange: (v) => setLocal(v[0] ?? local),
			onValueCommit: (v) => onCommit(v[0] ?? current)
		})]
	});
	if (!hint) return body;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
		content: hint,
		children: body
	});
}
function FillsTab({ snap }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HedgeRvStrip, { snap }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-4 md:grid-cols-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle",
					children: "Session index RV"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionRvChart, { snap })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle",
					children: "Path vol"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PathVolChart, { series: snap.series })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle",
					children: "Fill rate"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FillRateChart, { cycles: snap.cycles })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle",
					children: "Capture"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CaptureChart, { cycles: snap.cycles })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle",
					children: "Cumulative fill"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CumFillChart, { cycles: snap.cycles })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle",
					children: "Capture histogram"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CaptureHist, { cycles: snap.cycles })] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle",
					children: "Residual vs fill"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResidualVsFill, { cycles: snap.cycles })] })
			]
		})]
	});
}
function EvalPanel({ snap, setSnap }) {
	const coach = useMutation({
		mutationFn: () => runCoach(),
		onSuccess: setSnap,
		onError: (e) => toast.error(e.message)
	});
	const best = (0, import_react.useMemo)(() => {
		if (!snap.counterfactuals.length) return null;
		return [...snap.counterfactuals].sort((a, b) => a.estCostUsd * a.residualRms - b.estCostUsd * b.residualRms)[0];
	}, [snap.counterfactuals]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScoreRing, { quality: snap.quality }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle",
				children: "What the tuner thinks"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-2 text-sm text-muted",
				children: snap.suggestions.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "border-l-2 border-border pl-3",
					children: s
				}, s))
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle",
					children: "Interval counterfactual"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IntervalBars, { rows: snap.counterfactuals }),
				best ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-xs text-muted",
					children: [
						"Lowest cost×risk: ",
						best.intervalSec,
						"s · ",
						fmtUsd(best.estCostUsd, 0),
						" · residual RMS ",
						fmtNum(best.residualRms, 3)
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-xs text-muted",
					children: "Switch On and let a few cycles run."
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "secondary",
				onClick: () => coach.mutate(),
				disabled: coach.isPending,
				children: coach.isPending ? "Evaluating…" : "Run coach"
			}), snap.coach ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "mt-3 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-sans text-sm text-fg",
				children: snap.coach.text
			}) : null] })
		]
	});
}
function Home() {
	const { isPending } = useCurrentUserState();
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeskSkeleton, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignInGate, {
		fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeskLock, {}),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeelApp, {})
	});
}
function DeskSkeleton() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-2xl font-medium tracking-tight",
				children: "MCM Delta Hedger"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "Checking session…"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mt-6 h-10 w-48 animate-pulse rounded-md bg-surface-2" })
		]
	});
}
function DeskLock() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "grid min-h-dvh place-items-center bg-bg px-6 text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-sm space-y-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-10 w-1 rounded-full bg-border" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-2xl font-medium tracking-tight",
					children: "MCM Delta Hedger"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "Session lock. Sign in — keys and delta controls stay on your account only."
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-col gap-2",
					children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "secondary",
						className: "w-full",
						onClick: () => void signIn(p.providerId, { callbackURL: "/" }),
						children: ["Continue with ", p.label]
					}, p.providerId))
				})
			]
		})
	});
}
//#endregion
export { Home as component };
