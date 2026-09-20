const SECRETISH =
  /(?:client_secret|client_id|access_token|refresh_token|authorization)\s*[:=]\s*[^\s"'&,}]+/gi;

export function redact(input: unknown): string {
  const raw = input instanceof Error ? input.message : String(input ?? "");
  return raw
    .replace(SECRETISH, (m) => `${m.split(/[:=]/)[0]}=***`)
    .replace(/Bearer\s+\S+/gi, "Bearer ***")
    .replace(/\bsig=[a-f0-9]+/gi, "sig=***")
    .replace(/https:\/\/[^\s"'<>]+(?:hooks|webhook)[^\s"'<>]*/gi, "https://••••");
}

export function maskId(id: string) {
  if (!id || id.length <= 8) return "••••";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function maskUrl(url: string) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/••••`;
  } catch {
    return "••••";
  }
}
