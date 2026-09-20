import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const g = globalThis as typeof globalThis & { __mcmSealSecret__?: string };

function passphrase() {
  const env = process.env.BETTER_AUTH_SECRET?.trim();
  if (env && env.length >= 16) return env;
  g.__mcmSealSecret__ ??= randomBytes(32).toString("hex");
  return g.__mcmSealSecret__;
}

function key() {
  return scryptSync(passphrase(), "mcm-delta-hedger-v1", 32);
}

export function seal(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function openSealed(packed: string) {
  const [ivB, tagB, dataB] = packed.split(".");
  if (!ivB || !tagB || !dataB) throw new Error("Corrupt sealed payload.");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64url"));
  d.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([d.update(Buffer.from(dataB, "base64url")), d.final()]).toString("utf8");
}
