"use client";

import { useEffect, useState } from "react";

/**
 * iOS Safari blendet keinen Install-Prompt für Web-Apps ein — der User
 * muss selbst "Teilen → Zum Home-Bildschirm" antippen. Andere Plattformen
 * (Chrome/Edge auf Android, Chrome Desktop) bekommen den `beforeinstallprompt`-
 * Event und der Browser zeigt selbst einen Banner.
 *
 * Dieser Hinweis erscheint daher nur dann, wenn:
 *   1. wir auf iOS sind (UA-Sniff, weil es leider keine API gibt),
 *   2. die App noch nicht im Standalone-Modus läuft,
 *   3. der User den Hinweis nicht bereits weggeklickt hat.
 *
 * Dismiss wird in `localStorage` gemerkt — der Banner kommt also nicht
 * jedes Mal wieder. Bewusst kein Server-Roundtrip: das ist reine UI.
 */

const STORAGE_KEY = "cookingbot.ios-install-hint.dismissed";

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPad seit iPadOS 13 meldet sich als "Macintosh" — daher zusätzliche
  // Touch-Probe.
  const isIpadOS =
    /Macintosh/.test(ua) &&
    typeof document !== "undefined" &&
    "ontouchend" in document;
  return /iPad|iPhone|iPod/.test(ua) || isIpadOS;
}

function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS-spezifisch
  const iosStandalone =
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  // PWA-Standard
  const matchStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  return iosStandalone || matchStandalone;
}

export function IosInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIosDevice()) return;
    if (isRunningStandalone()) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // localStorage in Private-Mode evtl. blockiert — Banner trotzdem zeigen.
    }
    // Kurz warten, damit der Banner nicht direkt beim Laden ins Bild springt.
    const handle = window.setTimeout(() => setVisible(true), 1200);
    return () => window.clearTimeout(handle);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore — Dismiss hält dann nur diese Session.
    }
  };

  return (
    <div
      role="dialog"
      aria-label="App auf dem Home-Bildschirm installieren"
      className="ios-install-hint"
    >
      <div className="ios-install-hint__body">
        <strong className="ios-install-hint__title">Als App installieren</strong>
        <span className="ios-install-hint__text">
          Tippe auf{" "}
          <span aria-hidden className="ios-install-hint__icon">
            <svg
              width="16"
              height="20"
              viewBox="0 0 16 20"
              fill="none"
              aria-hidden
            >
              <path
                d="M8 1.5v11M4 5.5L8 1.5l4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 9.5v7a2 2 0 002 2h8a2 2 0 002-2v-7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>{" "}
          und dann <em>„Zum Home-Bildschirm“</em>.
        </span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="ios-install-hint__close"
        aria-label="Hinweis schließen"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
