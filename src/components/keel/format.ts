export function fmtNum(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  return sign + abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtDelta(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(4)}`;
}

export function fmtUsd(n: number, digits = 0) {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}

export function fmtBps(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(2)} bp`;
}

export function fmtTime(t: number) {
  return new Date(t).toLocaleTimeString("en-GB", { hour12: false });
}

export function fmtPct(n: number, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function signedClass(n: number) {
  if (n > 1e-8) return "text-long";
  if (n < -1e-8) return "text-short";
  return "text-muted";
}

export function fmtGreek(n: number) {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a === 0) return "0";
  if (a >= 1) return fmtNum(n, 2);
  if (a >= 0.01) return fmtNum(n, 3);
  if (a >= 0.0001) return fmtNum(n, 5);
  const sign = n < 0 ? "−" : "";
  return `${sign}${a.toExponential(1)}`;
}
