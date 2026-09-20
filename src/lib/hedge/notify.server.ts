import type { Alert } from "./types";
import { redact } from "./redact";

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|::1|\[::1\]|metadata\.google\.internal)$/i;

export function assertSafeWebhook(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("Webhook URL is not valid.");
  }
  if (parsed.protocol !== "https:") throw new Error("Webhook must be HTTPS.");
  if (PRIVATE_HOST.test(parsed.hostname) || PRIVATE_HOST.test(parsed.hostname + ".")) {
    throw new Error("Webhook host is not allowed.");
  }
  if (!parsed.hostname.includes(".")) throw new Error("Webhook host is not allowed.");
  return parsed.toString();
}

export async function postWebhook(url: string, alert: Alert) {
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
      currency: alert.currency ?? null,
    },
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body,
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(redact(`Webhook HTTP ${res.status}`));
}
