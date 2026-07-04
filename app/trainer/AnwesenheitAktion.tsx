"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { erfasseAnwesenheitAction } from "./actions";
import type { AnwesenheitWert } from "@/lib/attendance/anwesenheit";

// FZ-005 — Anwesenheit abhaken. Ruft die (in FZ-004 verifizierte) Server-Action;
// erneutes Klicken der aktiven Auswahl setzt auf "offen" zurück (Korrektur).

const FEHLER: Record<string, string> = {
  nicht_dein_kurs: "Nicht dein Kurs",
  zu_frueh: "Erst ab Kursbeginn",
  keine_buchung: "Keine Buchung",
  kurs_nicht_gefunden: "Kurs nicht gefunden",
  nicht_angemeldet: "Bitte anmelden",
  kein_trainer: "Kein Trainer-Profil",
};

const OPTIONEN: { wert: Exclude<AnwesenheitWert, "offen">; label: string; aktiv: string }[] = [
  { wert: "anwesend", label: "Anwesend", aktiv: "bg-green-700 text-white border-green-700" },
  { wert: "no_show", label: "No-Show", aktiv: "bg-red-700 text-white border-red-700" },
  { wert: "entschuldigt", label: "Entschuldigt", aktiv: "bg-amber-600 text-white border-amber-600" },
];

const base = "rounded border px-2.5 py-1 text-xs disabled:opacity-50";
const inaktiv = "border-gray-300 text-gray-700 hover:border-gray-500";

export function AnwesenheitAktion({
  kursterminId,
  mitgliedId,
  aktuell,
  erfassbar,
}: {
  kursterminId: string;
  mitgliedId: string;
  aktuell: AnwesenheitWert;
  erfassbar: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [wert, setWert] = useState<AnwesenheitWert>(aktuell);
  const [meldung, setMeldung] = useState<string | null>(null);

  function setze(neu: AnwesenheitWert) {
    start(async () => {
      const r = await erfasseAnwesenheitAction(kursterminId, mitgliedId, neu);
      if (r.status === "erfasst") {
        setWert(r.wert);
        setMeldung(null);
        router.refresh();
      } else {
        setMeldung(FEHLER[r.status] ?? r.status);
      }
    });
  }

  if (!erfassbar) {
    return <span className="text-xs text-gray-400">ab Kursbeginn erfassbar</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {OPTIONEN.map((o) => {
        const aktiv = wert === o.wert;
        return (
          <button
            key={o.wert}
            onClick={() => setze(aktiv ? "offen" : o.wert)}
            disabled={pending}
            title={aktiv ? "Nochmal klicken = zurücksetzen" : undefined}
            className={`${base} ${aktiv ? o.aktiv : inaktiv}`}
          >
            {o.label}
          </button>
        );
      })}
      {meldung && <span className="text-xs text-red-700">{meldung}</span>}
    </div>
  );
}
