"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bucheKursterminAction, type BuchungActionErgebnis } from "./actions";

type Status = BuchungActionErgebnis["status"];

const MELDUNG: Record<Status, { text: string; klasse: string }> = {
  bestaetigt: { text: "Gebucht ✓", klasse: "text-green-700" },
  voll: { text: "Ausgebucht — Warteliste folgt (FZ-002)", klasse: "text-amber-700" },
  bereits_gebucht: { text: "Bereits gebucht", klasse: "text-gray-600" },
  kurs_nicht_buchbar: { text: "Nicht buchbar", klasse: "text-red-700" },
  nicht_angemeldet: { text: "Bitte anmelden", klasse: "text-red-700" },
  kein_mitglied: { text: "Kein Mitglied-Profil verknüpft", klasse: "text-red-700" },
};

export function BuchenButton({
  kursterminId,
  bereitsGebucht,
}: {
  kursterminId: string;
  bereitsGebucht: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status | null>(
    bereitsGebucht ? "bereits_gebucht" : null,
  );

  function onBuchen() {
    start(async () => {
      const ergebnis = await bucheKursterminAction(kursterminId);
      setStatus(ergebnis.status);
      if (ergebnis.status === "bestaetigt") router.refresh();
    });
  }

  const gebucht = status === "bestaetigt" || status === "bereits_gebucht";
  const meldung = status ? MELDUNG[status] : null;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBuchen}
        disabled={pending || gebucht}
        className="rounded bg-black px-4 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {pending ? "…" : gebucht ? "Gebucht" : "Buchen"}
      </button>
      {meldung && <span className={`text-sm ${meldung.klasse}`}>{meldung.text}</span>}
    </div>
  );
}
