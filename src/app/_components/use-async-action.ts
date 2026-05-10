"use client";

/**
 * Hook für AJAX-Actions, die einen Toast wollen.
 *
 *   const { run, pending } = useAsyncAction();
 *   ...
 *   <button
 *     disabled={pending}
 *     onClick={() => run(
 *       async () => {
 *         const res = await fetch("/api/foo", { method: "POST" });
 *         if (!res.ok) throw new Error("Server hat einen Fehler gemeldet");
 *         return await res.json();
 *       },
 *       {
 *         pending: "Wird gespeichert…",
 *         success: "Gespeichert",
 *         error: "Speichern fehlgeschlagen",
 *       },
 *     )}
 *   >Speichern</button>
 *
 * Das Pending-Flag kann (und sollte) den Button disablen, sodass
 * Doppelklicks nicht zwei Requests auslösen. Bei Fehlern wird die
 * Exception NICHT verschluckt — sie wird wieder geworfen, damit der
 * Aufrufer eigene Cleanup-/Revert-Logik fahren kann.
 */
import { useCallback, useState } from "react";
import { useToast } from "./toast";

type AsyncMessages = {
  pending: string;
  success?: string | ((result: unknown) => string);
  error?: string | ((err: unknown) => string);
};

export function useAsyncAction() {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, messages: AsyncMessages): Promise<T | undefined> => {
      const id = toast.pending(messages.pending);
      setPending(true);
      try {
        const result = await fn();
        const successMsg =
          typeof messages.success === "function"
            ? messages.success(result)
            : (messages.success ?? "Erledigt");
        toast.success(id, successMsg);
        return result;
      } catch (err) {
        const errorMsg =
          typeof messages.error === "function"
            ? messages.error(err)
            : (messages.error ??
              (err instanceof Error ? err.message : "Etwas ist schiefgelaufen"));
        toast.error(id, errorMsg);
        // Re-throw, damit Caller selektiv reagieren können (z. B. UI-Revert).
        throw err;
      } finally {
        setPending(false);
      }
    },
    [toast],
  );

  return { run, pending };
}
