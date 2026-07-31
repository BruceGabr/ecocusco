import { useCallback, useEffect, useState } from "react";
import { request } from "../api";
import { Monitor } from "../types";

export function useMonitor() {
  const [monitor, setMonitor] = useState<Monitor>({});

  const refresh = useCallback(async () => {
    try {
      const payload = await request<Monitor>("/operations/monitor");
      setMonitor(payload);
    } catch (error) {
      console.error("Error loading monitor data:", error);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
    const interval = window.setInterval(() => {
      refresh().catch(() => {});
    }, 10000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { monitor, setMonitor, refresh };
}
