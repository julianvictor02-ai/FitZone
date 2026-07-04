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

const btn = "rounded px-4 py-1.5 text-sm disabled:cursor-not-allowed";

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
        setMeldung(r.gebuehrFaellig ? "Storniert — Gebühr fällig" : "Storniert ✓");
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
    <div className="flex items-center gap-3">
      {zustand === "buchbar" && (
        <button
          onClick={() => run(() => bucheKursterminAction(kursterminId))}
          disabled={pending}
          className={`${btn} bg-black text-white disabled:bg-gray-300`}
        >
          {pending ? "…" : "Buchen"}
        </button>
      )}

      {zustand === "voll" && (
        <button
          onClick={() => run(() => warteAction(kursterminId))}
          disabled={pending}
          className={`${btn} border border-black disabled:opacity-50`}
        >
          {pending ? "…" : "Warteliste beitreten"}
        </button>
      )}

      {zustand === "benachrichtigt" && (
        <button
          onClick={() => run(() => bestaetigeNachrueckungAction(kursterminId))}
          disabled={pending}
          className={`${btn} bg-green-700 text-white disabled:bg-gray-300`}
        >
          {pending ? "…" : `Nachrücken bestätigen${frist ? ` (bis ${frist})` : ""}`}
        </button>
      )}

      {zustand === "gebucht" && (
        <>
          <span className="text-sm font-medium text-green-700">Gebucht ✓</span>
          <button
            onClick={onStorniere}
            disabled={pending}
            title={stornoGebuehrDroht ? "Innerhalb der Frist — Stornogebühr fällig" : undefined}
            className={`${btn} border border-gray-400 disabled:opacity-50`}
          >
            {pending ? "…" : stornoGebuehrDroht ? "Stornieren (Gebühr)" : "Stornieren"}
          </button>
        </>
      )}

      {zustand === "wartend" && (
        <span className="text-sm text-gray-600">
          Warteliste · Position {position}
        </span>
      )}

      {zustand === "warteliste_voll" && (
        <span className="text-sm text-amber-700">Warteliste voll</span>
      )}

      {zustand === "livestream_gesperrt" && (
        <span
          className="text-sm text-gray-500"
          title="Livestream-Kurse sind ab Tarif Plus buchbar"
        >
          Nur ab Plus
        </span>
      )}

      {meldung && <span className="text-sm text-gray-600">{meldung}</span>}
    </div>
  );
}
