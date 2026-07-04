"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setzeTrainerNotizAction } from "./actions";

// FZ-012 — Trainer-Notiz je Teilnehmer. Freitext, jederzeit speicherbar; leeres Feld
// löscht die Notiz. Ruft die (verifizierte) Server-Action, die die Ownership prüft.

const FEHLER: Record<string, string> = {
  nicht_dein_kurs: "Nicht dein Kurs",
  keine_buchung: "Keine Buchung",
  kurs_nicht_gefunden: "Kurs nicht gefunden",
  nicht_angemeldet: "Bitte anmelden",
  kein_trainer: "Kein Trainer-Profil",
};

export function TrainerNotiz({
  kursterminId,
  mitgliedId,
  notiz,
}: {
  kursterminId: string;
  mitgliedId: string;
  notiz: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [wert, setWert] = useState(notiz ?? "");
  const [gespeichert, setGespeichert] = useState(notiz ?? "");
  const [meldung, setMeldung] = useState<string | null>(null);

  const geaendert = wert.trim() !== gespeichert.trim();

  function speichern() {
    start(async () => {
      const r = await setzeTrainerNotizAction(kursterminId, mitgliedId, wert);
      if (r.status === "gespeichert") {
        const neu = r.notiz ?? "";
        setWert(neu);
        setGespeichert(neu);
        setMeldung(null);
        router.refresh();
      } else {
        setMeldung(FEHLER[r.status] ?? r.status);
      }
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <textarea
        value={wert}
        onChange={(e) => setWert(e.target.value)}
        placeholder="Notiz (z. B. wirkte verletzt)"
        rows={2}
        className="w-full resize-y rounded border border-gray-300 px-2 py-1 text-xs"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={speichern}
          disabled={pending || !geaendert}
          className="rounded border border-gray-400 px-2.5 py-1 text-xs disabled:opacity-50"
        >
          {wert.trim() === "" && gespeichert !== "" ? "Löschen" : "Notiz speichern"}
        </button>
        {!geaendert && gespeichert !== "" && (
          <span className="text-xs text-gray-400">gespeichert</span>
        )}
        {meldung && <span className="text-xs text-red-700">{meldung}</span>}
      </div>
    </div>
  );
}
