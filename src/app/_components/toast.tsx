"use client";

/**
 * Globaler Toast-Provider für Cookingbot.
 *
 * Ein bewusst minimales Notification-System ohne externe Bibliothek.
 * Drei Toast-Typen: pending (mit Spinner, sticky), success (auto-dismiss
 * nach 4s) und error (sticky bis Tap). Toasts stacken nach unten,
 * sind unten-zentriert positioniert und respektieren `safe-area-inset-bottom`
 * sowie die Mobile-Tabbar.
 *
 * Typische Verwendung:
 *
 *   const toast = useToast();
 *   const id = toast.pending("Plan wird erstellt…");
 *   try {
 *     await fetch(...);
 *     toast.success(id, "Plan erstellt");
 *   } catch (err) {
 *     toast.error(id, "Plan konnte nicht erstellt werden");
 *   }
 *
 * Die Variante `toast.success(id, msg)` ersetzt einen vorhandenen Pending-
 * Toast in-place — das verhindert, dass der Spinner kurz aufblitzt und
 * direkt darauf ein neuer Success-Toast erscheint.
 *
 * Mobile-spezifisch:
 *  - Position über der Tabbar (siehe `.toast-stack` in globals.css).
 *  - Tap auf den Toast schließt ihn (Touch-Targets >=44px).
 *  - `aria-live="polite"` für pending/success, `role="alert"` für error.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastKind = "pending" | "success" | "error";

export type ToastEntry = {
  id: string;
  kind: ToastKind;
  message: string;
  /** Optional: zusätzlicher Hinweistext, kleiner gesetzt. */
  detail?: string;
};

type ToastApi = {
  /** Zeigt einen Pending-Toast und liefert die ID zum Ersetzen/Schließen zurück. */
  pending: (message: string, detail?: string) => string;
  /** Markiert einen bestehenden Toast als success oder erstellt einen neuen. */
  success: (idOrMessage: string, message?: string) => string;
  /** Markiert einen bestehenden Toast als error oder erstellt einen neuen. */
  error: (idOrMessage: string, message?: string) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const SUCCESS_TIMEOUT_MS = 4000;

let counter = 0;
function nextId(): string {
  counter += 1;
  return `t${Date.now().toString(36)}_${counter}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  // Map<id, timeoutHandle> — wir müssen Timeouts canceln, wenn ein Toast
  // vorher manuell entfernt wird, sonst räumt der Timer einen Toast weg,
  // der inzwischen gar nicht mehr existiert (oder durch denselben id-Slot
  // ersetzt wurde).
  const timeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimeout_ = useCallback((id: string) => {
    const handle = timeouts.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timeouts.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimeout_(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimeout_],
  );

  const scheduleAutoDismiss = useCallback(
    (id: string) => {
      clearTimeout_(id);
      const handle = setTimeout(() => dismiss(id), SUCCESS_TIMEOUT_MS);
      timeouts.current.set(id, handle);
    },
    [clearTimeout_, dismiss],
  );

  const pending = useCallback((message: string, detail?: string) => {
    const id = nextId();
    setToasts((prev) => [...prev, { id, kind: "pending", message, detail }]);
    return id;
  }, []);

  /**
   * Wenn das erste Argument einer bekannten Toast-ID entspricht, ersetzen
   * wir den vorhandenen Toast in-place. Sonst wird ein neuer angelegt.
   * Das erlaubt sowohl `toast.success(pendingId, "Erfolg")` als auch
   * `toast.success("Erfolg")` als kurzen one-shot.
   */
  const transition = useCallback(
    (kind: "success" | "error") =>
      (idOrMessage: string, maybeMessage?: string): string => {
        const lookForExisting = maybeMessage !== undefined;
        let resolvedId = lookForExisting ? idOrMessage : nextId();
        const message = lookForExisting ? maybeMessage : idOrMessage;

        setToasts((prev) => {
          if (lookForExisting) {
            const exists = prev.some((t) => t.id === idOrMessage);
            if (!exists) {
              // Pending-Toast wurde schon weggeräumt (z. B. Navigation),
              // dann legen wir den Status-Toast frisch an.
              const fresh = nextId();
              resolvedId = fresh;
              return [...prev, { id: fresh, kind, message, detail: undefined }];
            }
            return prev.map((t) =>
              t.id === idOrMessage ? { ...t, kind, message, detail: undefined } : t,
            );
          }
          return [...prev, { id: resolvedId, kind, message, detail: undefined }];
        });

        if (kind === "success") scheduleAutoDismiss(resolvedId);
        else clearTimeout_(resolvedId);
        return resolvedId;
      },
    [clearTimeout_, scheduleAutoDismiss],
  );

  // Beim Unmount des Providers (Navigation Logout etc.) alle Timer aufräumen,
  // damit kein dangling setTimeout später `setState` auf einen unmountierten
  // Provider feuert.
  useEffect(() => {
    const map = timeouts.current;
    return () => {
      for (const handle of map.values()) clearTimeout(handle);
      map.clear();
    };
  }, []);

  // Bei klassischen Form-Submits navigiert der Browser — der Provider
  // wird normalerweise neu gemountet und alle Pending-Toasts sind weg.
  // Im BFCache (zurück-Navigation) bleibt der State aber erhalten,
  // sodass alte Pending-Toasts weiter sichtbar wären. Wir hören auf
  // `pageshow` (persisted) und räumen Pending-Toasts auf, die nichts
  // mehr signalisieren können.
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      setToasts((prev) => prev.filter((t) => t.kind !== "pending"));
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      pending,
      success: transition("success"),
      error: transition("error"),
      dismiss,
    }),
    [pending, transition, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Hook für Komponenten, die Toasts auslösen wollen. Wirft, wenn ohne
 * ToastProvider verwendet — das ist Absicht, sonst entstehen unsichtbare
 * Toasts und der Bug fällt erst bei Bug-Reports auf.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastEntry[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id} entry={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function Toast({ entry, onDismiss }: { entry: ToastEntry; onDismiss: () => void }) {
  const isError = entry.kind === "error";
  return (
    <button
      type="button"
      className={`toast toast-${entry.kind}`}
      onClick={onDismiss}
      // Pending-Toasts und Success-Toasts sind „status", Error sind „alert".
      // Letzteres unterbricht Screenreader, was bei Fehlermeldungen
      // erwünscht ist.
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-label={`${entry.message}${entry.detail ? `. ${entry.detail}` : ""} (zum Schließen tippen)`}
    >
      <span className="toast-icon" aria-hidden>
        {entry.kind === "pending" ? <Spinner /> : entry.kind === "success" ? <Check /> : <Cross />}
      </span>
      <span className="toast-text">
        <span className="toast-msg">{entry.message}</span>
        {entry.detail ? <span className="toast-detail">{entry.detail}</span> : null}
      </span>
    </button>
  );
}

function Spinner() {
  return <span className="toast-spinner" />;
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}
