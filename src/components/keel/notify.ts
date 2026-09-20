import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Alert } from "@/lib/hedge/types";

export function useAlertNotify(alerts: Alert[]) {
  const seen = useRef(new Set<string>());
  const primed = useRef(false);
  useEffect(() => {
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
        new Notification(`MCM Δ · ${a.title}`, { body: a.detail, tag: a.kind });
      } catch {
        /* ignore */
      }
      if (a.severity === "critical") toast.error(a.title);
      else toast.message(a.title);
    }
  }, [alerts]);
}
