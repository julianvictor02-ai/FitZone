"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bucheKursterminAction,
  warteAction,
  bestaetigeNachrueckungAction,
  storniereBuchungAction,
} from "./actions";

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
  const [meldung, setMeldung] = useState<string | null>(null);

  function run(action: () => Promise<{ status: string }>) {
    start(async () => {
      const r = await action();
      setMeldung(MELDUNG[r.status] ?? r.status);
      if (AKTUALISIEREN.has(r.status)) router.refresh();
    });
  }

  function onStorniere() {
    start(async () => {
      const r = await storniereBuchungAction(kursterminId);
      if (r.status === "storniert") {
        setMeldung(
          r.gebuehrFaellig
            ? `Storniert — Gebühr fällig${r.betrag != null ? ` (${EUR.format(r.betrag)})` : ""}`
            : "Storniert ✓",
        );
        router.refresh();
      } else {
        setMeldung(MELDUNG[r.status] ?? r.status);
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
          {pending ? "…" : "Buchen"}
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
            {pending ? "…" : "Auf Warteliste"}
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
            {pending ? "…" : "Nachrücken bestätigen"}
          </button>
          <p className="hinweis hinweis-ok">
            Platz frei{frist ? ` — bitte bis ${frist} bestätigen` : ""}.
          </p>
        </>
      )}

      {zustand === "gebucht" && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="badge badge-success">Gebucht ✓</span>
            <button
              onClick={onStorniere}
              disabled={pending}
              className="btn btn-outline"
            >
              {pending ? "…" : "Stornieren"}
            </button>
          </div>
          {stornoGebuehrDroht && (
            <p className="hinweis">Innerhalb der Frist — bei Storno wird eine Gebühr fällig.</p>
          )}
        </>
      )}

      {zustand === "wartend" && (
        <span className="badge badge-warn">Warteliste · Platz {position}</span>
      )}

      {zustand === "warteliste_voll" && (
        <span className="badge badge-warn">Warteliste voll</span>
      )}

      {zustand === "livestream_gesperrt" && (
        <span className="badge badge-muted" title="Livestream-Kurse sind ab Tarif Plus buchbar">
          Nur ab Plus
        </span>
      )}

      {meldung && <span className="hinweis" role="status">{meldung}</span>}
    </div>
  );
}
