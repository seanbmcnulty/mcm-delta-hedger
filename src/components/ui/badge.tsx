import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "long" | "short" | "warn" | "muted" }) {
  const tones = {
    neutral: "bg-surface-2 text-fg",
    long: "bg-long/15 text-long",
    short: "bg-short/15 text-short",
    warn: "bg-warn/15 text-warn",
    muted: "bg-surface-2 text-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
