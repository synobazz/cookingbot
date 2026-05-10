"use client";

import { useEffect } from "react";

/**
 * Registriert `/sw.js` einmal pro Tab. Bewusst nur in Production aktiv —
 * im Dev-Modus ist HMR + SW eine zuverlässige Quelle für Verwirrung
 * ("Warum sehe ich meine Änderung nicht?"). Dev-Tab räumt auch alte
 * SWs auf, falls einer vom letzten Build hängengeblieben ist.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) {
          if (reg.active?.scriptURL.endsWith("/sw.js")) reg.unregister();
        }
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Silent fail — PWA-Funktionalität ist Bonus, kein Hard-Requirement.
    });
  }, []);

  return null;
}
