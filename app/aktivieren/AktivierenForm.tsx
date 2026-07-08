"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { aktiviereKontoAction, type AktivierenState } from "./actions";
import { PASSWORT_MIN } from "@/lib/auth/konstanten";
import { Check, Eye, EyeOff, XCircle } from "@/components/icons";

// „Konto aktivieren" — Erstlogin für admin-angelegte Mitglieder. Gleicher Look wie der
// Login-Screen (Weiß/Hellgrün, dieselben Input-/Button-Klassen). Bei Erfolg leitet die
// Server-Action direkt weiter (Auto-Login), daher braucht das Formular nur Fehlerzustände.

const FEHLER: Record<Exclude<AktivierenState["status"], "idle">, string> = {
  // Neutral gehalten: kein Enumerieren gültiger E-Mails.
  ungueltig:
    "Diese E-Mail ist unbekannt oder das Konto wurde bereits aktiviert. Bitte wende dich an FitZone.",
  passwort_schwach: `Das Passwort muss mindestens ${PASSWORT_MIN} Zeichen haben.`,
  passwort_ungleich: "Die Passwörter stimmen nicht überein.",
};

export function AktivierenForm() {
  const [state, formAction, pending] = useActionState(aktiviereKontoAction, {
    status: "idle" as const,
  });
  const [showPw, setShowPw] = useState(false);

  const fehler = state.status !== "idle";

  return (
    <>
      <div className="brandmark">
        <div>
          <h1 className="page-title">Konto aktivieren</h1>
          <p className="subtitle">
            Für Mitglieder, die FitZone angelegt hat: E-Mail eingeben, Passwort setzen — und
            los.
          </p>
        </div>
      </div>

      <form action={formAction} className={`flex flex-col gap-4 ${fehler ? "shake" : ""}`}>
        {fehler && (
          <p className="login-error" role="alert">
            <XCircle /> {FEHLER[state.status as keyof typeof FEHLER]}
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
          Passwort (mind. {PASSWORT_MIN} Zeichen)
          <span className="pw-wrap">
            <input
              type={showPw ? "text" : "password"}
              name="passwort"
              required
              minLength={PASSWORT_MIN}
              autoComplete="new-password"
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

        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Passwort bestätigen
          <input
            type={showPw ? "text" : "password"}
            name="passwortBestaetigung"
            required
            minLength={PASSWORT_MIN}
            autoComplete="new-password"
            className="input"
            aria-invalid={fehler || undefined}
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary btn-block mt-1"
        >
          {pending ? <span className="spinner" /> : <><Check /> Konto aktivieren</>}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        Schon aktiviert? <Link href="/login">Zur Anmeldung</Link>
      </p>
    </>
  );
}
