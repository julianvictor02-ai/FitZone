"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "./actions";
import { Baum, type BaumStatus } from "./Baum";
import { LogIn, Eye, EyeOff, XCircle } from "@/components/icons";

// Nur UI/Feedback — die Validierung (signInWithPassword) steckt unverändert in der
// Server-Action `login`, die jetzt ihr Ergebnis zurückgibt. Der Baum reagiert nur auf
// dieses Ergebnis: rot „Falsch" bzw. grün „Danke", danach Weiterleitung bei Erfolg.

export function LoginForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(login, { status: "idle" as const });
  const [showPw, setShowPw] = useState(false);
  const [phase, setPhase] = useState<"idle" | "ok" | "fehler">("idle");
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (state.status === "idle") return;
    setPulseKey((k) => k + 1);
    const vibrate = (p: number | number[]) => {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(p);
    };
    if (state.status === "ok") {
      setPhase("ok");
      vibrate(20);
      // kurz „Danke" zeigen, dann weiterleiten (Auth-Cookies wurden serverseitig gesetzt)
      const t = setTimeout(() => router.replace("/"), 850);
      return () => clearTimeout(t);
    }
    setPhase("fehler");
    vibrate([10, 40, 10]);
    // roten Puls kurz zeigen, dann Baum in den Ruhezustand; Fehlerhinweis bleibt sichtbar
    const t = setTimeout(() => setPhase("idle"), 900);
    return () => clearTimeout(t);
  }, [state.status, state.t, router]);

  const baumStatus: BaumStatus = pending ? "pending" : phase;
  const fehler = state.status === "fehler";

  return (
    <>
      <div className="brandmark">
        <Baum status={baumStatus} pulseKey={pulseKey} />
        <div>
          <h1 className="page-title">FitZone</h1>
          <p className="subtitle">Willkommen zurück – melde dich an.</p>
        </div>
      </div>

      <form
        action={formAction}
        className={`flex flex-col gap-4 ${phase === "fehler" ? "shake" : ""}`}
      >
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

        <button
          type="submit"
          disabled={pending || phase === "ok"}
          className="btn btn-primary btn-block mt-1"
        >
          {pending ? <span className="spinner" /> : <><LogIn /> Anmelden</>}
        </button>
      </form>
    </>
  );
}
