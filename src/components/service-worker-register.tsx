"use client";

import { useEffect } from "react";

/** Registers /sw.js on every page so push keeps working even if Alerts is never reopened. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
  }, []);
  return null;
}
