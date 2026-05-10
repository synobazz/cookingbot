"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "../_components/icons";
import { PendingForm, PendingButton } from "../_components/pending-form";

export function LoginForm({ errorMessage }: { errorMessage: string | null }) {
  const [show, setShow] = useState(false);
  return (
    <PendingForm className="login-form" method="post" action="/api/auth/login" pendingMessage="Anmeldung läuft…">
      {errorMessage ? (
        <p role="alert" aria-live="polite" style={{ color: "var(--warn)", margin: 0, fontSize: ".88rem" }}>
          {errorMessage}
        </p>
      ) : null}
      <div>
        <label className="label" htmlFor="password">
          Passwort
        </label>
        <div className="input-pw">
          <input
            className="input"
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••••"
            autoFocus
            required
          />
          <button
            type="button"
            aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
            aria-pressed={show}
            onClick={() => setShow((s) => !s)}
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>
      <PendingButton className="btn block" type="submit">
        In die Küche
      </PendingButton>
    </PendingForm>
  );
}
