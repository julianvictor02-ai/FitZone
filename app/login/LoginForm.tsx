"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { login } from "./actions";
import { LogIn, Eye, EyeOff, XCircle } from "@/components/icons";

// Nur UI/Feedback — die Auth-Logik steckt unverändert in der Server-Action `login`
// (Fehler → /login?fehler=1, Erfolg → /). useFormStatus liefert den Pending-Zustand
// während des Requests → Button disabled + Spinner (kein Doppel-Submit).

function AnmeldenButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-block mt-1">
      {pending ? <span className="spinner" /> : <><LogIn /> Anmelden</>}
    </button>
  );
}

export function LoginForm({ fehler }: { fehler: boolean }) {
  const [showPw, setShowPw] = useState(false);
  const [shake, setShake] = useState(false);

  // Bei Fehlanmeldung (Seite kam mit ?fehler=1 zurück): kurze Shake-Animation
  // + dezente Fehlvibration. prefers-reduced-motion neutralisiert die Animation global.
  useEffect(() => {
    if (!fehler) return;
    setShake(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([10, 40, 10]);
    }
    const t = setTimeout(() => setShake(false), 450);
    return () => clearTimeout(t);
  }, [fehler]);

  return (
    <form action={login} className={`flex flex-col gap-4 ${shake ? "shake" : ""}`}>
      {fehler && (
        <p className="login-error" role="alert">
          <XCircle /> E-Mail oder Passwort stimmt nicht. Bitte versuch es noch einmal.
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        E-Mail
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          className="input"
          aria-invalid={fehler || undefined}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Passwort
        <span className="pw-wrap">
          <input
            type={showPw ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            className="input"
            aria-invalid={fehler || undefined}
          />
          <button
            type="button"
            className="pw-toggle"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
            aria-pressed={showPw}
          >
            {showPw ? <EyeOff /> : <Eye />}
          </button>
        </span>
      </label>

      <AnmeldenButton />
    </form>
  );
}
