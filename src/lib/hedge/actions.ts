import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { ConnectInput, HedgeConfig, Venue } from "./types";
import type { FreqId, LookbackId } from "./rv";

export const getSnapshot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const runtime = await import("./runtime.server");
    return runtime.snapshot(context.userId);
  });

export const connectVenue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: ConnectInput) => input)
  .handler(async ({ context, data }) => {
    const runtime = await import("./runtime.server");
    return runtime.connect(context.userId, data);
  });

export const disconnectVenue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const runtime = await import("./runtime.server");
    return runtime.disconnect(context.userId);
  });

export const updateConfig = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Partial<HedgeConfig>) => input)
  .handler(async ({ context, data }) => {
    const runtime = await import("./runtime.server");
    return runtime.patchConfig(context.userId, data);
  });

export const resetConfig = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const runtime = await import("./runtime.server");
    return runtime.resetConfig(context.userId);
  });

export const armEngine = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { confirm?: string } = {}) => input)
  .handler(async ({ context, data }) => {
    const runtime = await import("./runtime.server");
    return runtime.arm(context.userId, data?.confirm);
  });

export const disarmEngine = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const runtime = await import("./runtime.server");
    return runtime.disarm(context.userId);
  });

export const killEngine = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const runtime = await import("./runtime.server");
    return runtime.kill(context.userId);
  });

export const tickEngine = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const runtime = await import("./runtime.server");
    return runtime.tick(context.userId, "client");
  });

export const runCoach = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const runtime = await import("./runtime.server");
    return runtime.runCoach(context.userId);
  });

export const setVenue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { venue: Venue }) => input)
  .handler(async ({ context, data }) => {
    const runtime = await import("./runtime.server");
    return runtime.setVenue(context.userId, data.venue);
  });

export const selectRvCell = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { freqId: FreqId; lookbackId: LookbackId }) => input)
  .handler(async ({ context, data }) => {
    const runtime = await import("./runtime.server");
    return runtime.selectRvCell(context.userId, data.freqId, data.lookbackId);
  });

export const refreshRvSurface = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const runtime = await import("./runtime.server");
    return runtime.refreshRvNow(context.userId);
  });

export const ackAlerts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { ids?: string[] } = {}) => input)
  .handler(async ({ context, data }) => {
    const runtime = await import("./runtime.server");
    return runtime.ackAlerts(context.userId, data?.ids);
  });

export const testAlert = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const runtime = await import("./runtime.server");
    return runtime.testAlert(context.userId);
  });

export const tripFailsafe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const runtime = await import("./runtime.server");
    return runtime.tripNow(context.userId);
  });

export const setWebhook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { url: string | null }) => input)
  .handler(async ({ context, data }) => {
    const runtime = await import("./runtime.server");
    return runtime.setWebhook(context.userId, data.url);
  });
