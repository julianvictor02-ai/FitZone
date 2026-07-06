"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bucheKursterminAction,
  warteAction,
  bestaetigeNachrueckungAction,
  storniereBuchungAction,
} from "./actions";
import { Check, CheckCircle, Hourglass, Ban, XCircle } from "@/components/icons";

export type Zustand =
  | "buchbar"
  | "voll"
  | "warteliste_voll"
  | "gebucht"
  | "wartend"
  | "benachrichtigt"
  | "livestream_gesperrt";

const MELDUNG: Record<string, string> = {
  bestaetigt: "Gebucht ✓",
  voll: "Ausgebucht",
  bereits_gebucht: "Bereits gebucht",
  limit_erreicht: "Monatslimit erreicht (Basic: 5/Monat)",
  kurs_nicht_buchbar: "Nicht buchbar",
  nicht_angemeldet: "Bitte anmelden",
  kein_mitglied: "Kein Mitglied-Profil",
  wartend: "Auf Warteliste ✓",
  platz_frei: "Platz frei — bitte buchen",
  bereits_wartend: "Bereits auf Warteliste",
  warteliste_voll: "Warteliste voll",
  nachgerueckt: "Nachgerückt & gebucht ✓",
  abgelaufen: "Frist abgelaufen",
  kein_angebot: "Kein Nachrück-Angebot",
  livestream_gesperrt: "Livestreams nur ab Plus",
};

const AKTUALISIEREN = new Set([
  "bestaetigt",
  "wartend",
  "nachgerueckt",
  "abgelaufen",
  "platz_frei",
]);

// Positive Ergebnisse → grüner Erfolgs-Toast + kurzer haptischer Impuls.
const ERFOLG = new Set(["bestaetigt", "wartend", "nachgerueckt", "storniert"]);

const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function KursterminAktion({
  kursterminId,
  zustand,
  position,
  fristBisISO,
  stornoGebuehrDroht,
}: {
  kursterminId: string;
  zustand: Zustand;
  position?: number;
  fristBisISO?: string;
  stornoGebuehrDroht?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function zeigeToast(text: string, ok: boolean) {
    setToast({ text, ok });
    if (ok && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(18); // dezenter Erfolgs-Impuls (Mobil)
    }
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  function run(action: () => Promise<{ status: string }>) {
    start(async () => {
      const r = await action();
      zeigeToast(MELDUNG[r.status] ?? r.status, ERFOLG.has(r.status));
      if (AKTUALISIEREN.has(r.status)) router.refresh();
    });
  }

  function onStorniere() {
    start(async () => {
      const r = await storniereBuchungAction(kursterminId);
      if (r.status === "storniert") {
        zeigeToast(
          r.gebuehrFaellig
            ? `Storniert — Gebühr fällig${r.betrag != null ? ` (${EUR.format(r.betrag)})` : ""}`
            : "Storniert ✓",
          true,
        );
        router.refresh();
      } else {
        zeigeToast(MELDUNG[r.status] ?? r.status, false);
      }
    });
  }

  const frist = fristBisISO
    ? new Date(fristBisISO).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="flex flex-col gap-2">
      {zustand === "buchbar" && (
        <button
          onClick={() => run(() => bucheKursterminAction(kursterminId))}
          disabled={pending}
          className="btn btn-primary btn-block"
        >
          {pending ? <span className="spinner" /> : <><Check /> Buchen</>}
        </button>
      )}

      {/* Voller Kurs: gleiche Stelle, aus „Buchen" wird „Auf Warteliste" (FIFO server-seitig). */}
      {zustand === "voll" && (
        <>
          <button
            onClick={() => run(() => warteAction(kursterminId))}
            disabled={pending}
            className="btn btn-primary btn-block"
          >
            {pending ? <span className="spinner" /> : <><Hourglass /> Auf Warteliste</>}
          </button>
          <p className="hinweis">Kurs ausgebucht — du rückst per Warteliste (FIFO) nach.</p>
        </>
      )}

      {zustand === "benachrichtigt" && (
        <>
          <button
            onClick={() => run(() => bestaetigeNachrueckungAction(kursterminId))}
            disabled={pending}
            className="btn btn-primary btn-block"
          >
            {pending ? <span className="spinner" /> : <><Check /> Nachrücken bestätigen</>}
          </button>
          <p className="hinweis hinweis-ok">
            <CheckCircle /> Platz frei{frist ? ` — bitte bis ${frist} bestätigen` : ""}.
          </p>
        </>
      )}

      {zustand === "gebucht" && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="badge badge-success pop">
              <CheckCircle /> Gebucht
            </span>
            <button onClick={onStorniere} disabled={pending} className="btn btn-outline">
              {pending ? <span className="spinner spinner-ink" /> : <><XCircle /> Stornieren</>}
            </button>
          </div>
          {stornoGebuehrDroht && (
            <p className="hinweis">Innerhalb der Frist — bei Storno wird eine Gebühr fällig.</p>
          )}
        </>
      )}

      {zustand === "wartend" && (
        <span className="badge badge-warn">
          <Hourglass /> Warteliste · Platz {position}
        </span>
      )}

      {zustand === "warteliste_voll" && (
        <span className="badge badge-warn">
          <Ban /> Warteliste voll
        </span>
      )}

      {zustand === "livestream_gesperrt" && (
        <span className="badge badge-muted" title="Livestream-Kurse sind ab Tarif Plus buchbar">
          <Ban /> Nur ab Plus
        </span>
      )}

      {toast && (
        <div className={`toast ${toast.ok ? "toast-ok" : ""}`} role="status" aria-live="polite">
          {toast.ok ? <CheckCircle /> : <XCircle />}
          {toast.text}
        </div>
      )}
    </div>
  );
}
