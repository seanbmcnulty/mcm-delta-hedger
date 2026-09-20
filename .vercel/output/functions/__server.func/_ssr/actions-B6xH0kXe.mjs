import { i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware-DMJwzugt.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/actions-B6xH0kXe.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var getSnapshot_createServerFn_handler = createServerRpc({
	id: "db95fcd0cb61cf78ed13aa6377cdc9f0050cfcc2b7371f918b951eceb798ca2c",
	name: "getSnapshot",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => getSnapshot.__executeServer(opts));
var getSnapshot = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(getSnapshot_createServerFn_handler, async ({ context }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).snapshot(context.userId);
});
var connectVenue_createServerFn_handler = createServerRpc({
	id: "baa77a2a29e7975201822e109fecf276998c05ad9efe9e6c46a1bbebdc78fd03",
	name: "connectVenue",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => connectVenue.__executeServer(opts));
var connectVenue = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(connectVenue_createServerFn_handler, async ({ context, data }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).connect(context.userId, data);
});
var disconnectVenue_createServerFn_handler = createServerRpc({
	id: "cbb0a7d7574f3fee5bd11d195214f7d1f7a8cc99c295f1b8f1610149c9eca6fe",
	name: "disconnectVenue",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => disconnectVenue.__executeServer(opts));
var disconnectVenue = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(disconnectVenue_createServerFn_handler, async ({ context }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).disconnect(context.userId);
});
var updateConfig_createServerFn_handler = createServerRpc({
	id: "e7ed75642f19d26b5fabe3ebbfa6109fc8b4c6787bb7235fde47164f42604d5e",
	name: "updateConfig",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => updateConfig.__executeServer(opts));
var updateConfig = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(updateConfig_createServerFn_handler, async ({ context, data }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).patchConfig(context.userId, data);
});
var resetConfig_createServerFn_handler = createServerRpc({
	id: "7d842c5a25efc1e81850ae40722de12ef3ff142ddcac3cbce3b689649f4c4f55",
	name: "resetConfig",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => resetConfig.__executeServer(opts));
var resetConfig = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(resetConfig_createServerFn_handler, async ({ context }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).resetConfig(context.userId);
});
var armEngine_createServerFn_handler = createServerRpc({
	id: "cedbbe2e6fbae691f34475cabdfe59064f8fbb50a8c0215db9db1b480560dc40",
	name: "armEngine",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => armEngine.__executeServer(opts));
var armEngine = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input = {}) => input).handler(armEngine_createServerFn_handler, async ({ context, data }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).arm(context.userId, data?.confirm);
});
var disarmEngine_createServerFn_handler = createServerRpc({
	id: "7e37b77f9f627178fe32fc44187db2884de69abe95db15c396e41f8549002b18",
	name: "disarmEngine",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => disarmEngine.__executeServer(opts));
var disarmEngine = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(disarmEngine_createServerFn_handler, async ({ context }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).disarm(context.userId);
});
var killEngine_createServerFn_handler = createServerRpc({
	id: "9e1703418daee024800343dbabbd508090cd49772a21e3aee43fd643a3006682",
	name: "killEngine",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => killEngine.__executeServer(opts));
var killEngine = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(killEngine_createServerFn_handler, async ({ context }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).kill(context.userId);
});
var tickEngine_createServerFn_handler = createServerRpc({
	id: "2ba47c8127c46c4a035eced5e4e0c17b7102e3c2374dc00e930ea0794003c070",
	name: "tickEngine",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => tickEngine.__executeServer(opts));
var tickEngine = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(tickEngine_createServerFn_handler, async ({ context }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).tick(context.userId, "client");
});
var runCoach_createServerFn_handler = createServerRpc({
	id: "d1a51cf82e77f98fe0ea0210af8521a41152d9f83a41b99334afd56fce1fee97",
	name: "runCoach",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => runCoach.__executeServer(opts));
var runCoach = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(runCoach_createServerFn_handler, async ({ context }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).runCoach(context.userId);
});
var setVenue_createServerFn_handler = createServerRpc({
	id: "721b0157dab8ddf0bd393a03d5f0efd2fc1206636ae48b070712ff7b9a8f7978",
	name: "setVenue",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => setVenue.__executeServer(opts));
var setVenue = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(setVenue_createServerFn_handler, async ({ context, data }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).setVenue(context.userId, data.venue);
});
var selectRvCell_createServerFn_handler = createServerRpc({
	id: "4d2099d8d943a37aff264f65a29ec63696beed95aee36a8413d9e6341bf353f3",
	name: "selectRvCell",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => selectRvCell.__executeServer(opts));
var selectRvCell = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(selectRvCell_createServerFn_handler, async ({ context, data }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).selectRvCell(context.userId, data.freqId, data.lookbackId);
});
var refreshRvSurface_createServerFn_handler = createServerRpc({
	id: "ee48770a97f1c7da526c174131e0f16b38b2e148f17a85a59cd20b928ebea3f2",
	name: "refreshRvSurface",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => refreshRvSurface.__executeServer(opts));
var refreshRvSurface = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(refreshRvSurface_createServerFn_handler, async ({ context }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).refreshRvNow(context.userId);
});
var ackAlerts_createServerFn_handler = createServerRpc({
	id: "f8e2bae8419e7d8f5bd10b7c4ca0da1afd579e26808d7741dedda0219b4c6738",
	name: "ackAlerts",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => ackAlerts.__executeServer(opts));
var ackAlerts = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input = {}) => input).handler(ackAlerts_createServerFn_handler, async ({ context, data }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).ackAlerts(context.userId, data?.ids);
});
var testAlert_createServerFn_handler = createServerRpc({
	id: "0519508bc10c288cf6f51c6c6b55905b8c171d956ee8f4127464652fcb719c15",
	name: "testAlert",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => testAlert.__executeServer(opts));
var testAlert = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(testAlert_createServerFn_handler, async ({ context }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).testAlert(context.userId);
});
var tripFailsafe_createServerFn_handler = createServerRpc({
	id: "a765fee8d0589552a0be431ba2bb53984c3ae6fafc623b4457d47c6cd8cfbdf6",
	name: "tripFailsafe",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => tripFailsafe.__executeServer(opts));
var tripFailsafe = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(tripFailsafe_createServerFn_handler, async ({ context }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).tripNow(context.userId);
});
var setWebhook_createServerFn_handler = createServerRpc({
	id: "7279d7f200e339255db912ac03c7c8a8aa7310b9b634fc7cdc2a5cb641402c29",
	name: "setWebhook",
	filename: "src/lib/hedge/actions.ts"
}, (opts) => setWebhook.__executeServer(opts));
var setWebhook = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(setWebhook_createServerFn_handler, async ({ context, data }) => {
	return (await import("./runtime.server-CwKahFLN.mjs")).setWebhook(context.userId, data.url);
});
//#endregion
export { ackAlerts_createServerFn_handler, armEngine_createServerFn_handler, connectVenue_createServerFn_handler, disarmEngine_createServerFn_handler, disconnectVenue_createServerFn_handler, getSnapshot_createServerFn_handler, killEngine_createServerFn_handler, refreshRvSurface_createServerFn_handler, resetConfig_createServerFn_handler, runCoach_createServerFn_handler, selectRvCell_createServerFn_handler, setVenue_createServerFn_handler, setWebhook_createServerFn_handler, testAlert_createServerFn_handler, tickEngine_createServerFn_handler, tripFailsafe_createServerFn_handler, updateConfig_createServerFn_handler };
