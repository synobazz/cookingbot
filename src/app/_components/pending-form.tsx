"use client";

/**
 * Wrapper-Komponenten für klassische HTML-Form-Submits, die den globalen
 * Toast-Provider mit Pending/Success/Error-Status füttern.
 *
 * Hintergrund: bei einem klassischen `<form action="/api/…" method="post">`
 * navigiert der Browser nach dem POST. Wir müssen also vor dem Submit
 * einen Pending-Toast feuern, der danach automatisch verschwindet, wenn
 * die neue Seite geladen wird (`pageshow`-Event).
 *
 * Zwei Komponenten:
 *
 *   <PendingForm action="…" method="post" pendingMessage="Wird gemacht…">
 *     <input … />
 *     <button type="submit">Los</button>
 *   </PendingForm>
 *
 *   <PendingButton pendingMessage="Wird gemacht…" formAction="…">
 *     Los
 *   </PendingButton>   // für Multi-Submit-Forms mit verschiedenen Actions
 *
 * Beide nutzen `useFormStatus` und sind serverseitig zwar als Client
 * Components markiert, leben aber nur als kleine Wrapper um native
 * Form-Elemente — keine Hydration-Kosten jenseits eines Listeners.
 */
import { useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useToast } from "./toast";

type FormProps = React.FormHTMLAttributes<HTMLFormElement> & {
  pendingMessage?: string;
  pendingDetail?: string;
};

/**
 * Drop-in für `<form>`. Triggert beim Submit einen Pending-Toast
 * (sofern `pendingMessage` gesetzt ist). Erfolgs-/Fehler-Status kommt
 * dann nach dem Server-Redirect über bestehende `?error=` / Server-
 * Notices oder, in Zukunft, über die zentrale Notice-Lese-Logik.
 */
export function PendingForm({
  pendingMessage,
  pendingDetail,
  onSubmit,
  children,
  ...rest
}: FormProps) {
  const toast = useToast();
  const lastIdRef = useRef<string | null>(null);

  return (
    <form
      {...rest}
      onSubmit={(event) => {
        if (pendingMessage) {
          // Vorherigen Toast für dieselbe Form schließen, falls noch
          // sichtbar (z. B. Doppelklick im Kondensator-Moment).
          if (lastIdRef.current) toast.dismiss(lastIdRef.current);
          lastIdRef.current = toast.pending(pendingMessage, pendingDetail);
        }
        if (onSubmit) onSubmit(event);
      }}
    >
      {children}
    </form>
  );
}

/**
 * Submit-Button mit eingebautem Pending-State. Nutzt `useFormStatus`,
 * funktioniert also nur innerhalb eines `<form>`. Disabled sich selbst
 * + zeigt Spinner solange der Submit läuft.
 *
 * Wenn `pendingMessage` gesetzt ist, feuert er zusätzlich einen Toast.
 * Bei einem `<PendingForm>`-Parent wird der Toast doppelt vermieden
 * (Form-Submit-Handler dort übernimmt). In Misch-Formen (Standard
 * `<form>` + dieser Button) übernimmt der Button.
 */
export function PendingButton({
  children,
  pendingMessage,
  pendingDetail,
  className,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingMessage?: string;
  pendingDetail?: string;
}) {
  const { pending } = useFormStatus();
  const toast = useToast();
  const id = useId();
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingMessage) return;
    // Wenn dieser konkrete Button gerade pending ist und noch kein
    // Toast existiert, einen feuern. Wenn pending vorbei ist, lassen
    // wir den Toast vom pageshow-Reset / Navigation aufräumen.
    if (pending && !toastIdRef.current) {
      toastIdRef.current = toast.pending(pendingMessage, pendingDetail);
    }
  }, [pending, pendingMessage, pendingDetail, toast]);

  return (
    <button
      {...rest}
      data-pending-id={id}
      disabled={disabled || pending}
      aria-busy={pending}
      className={[className, pending ? "is-loading" : ""].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}
