"use client";

import { useState } from "react";

// FZ-020/FZ-021 — Trainer schlägt einen Kurs vor. Die Kapazität wird beim Wechsel von
// Kursart/Modus aus dem Kurstyp-Standard (FZ-021, admin-gepflegt) vorbelegt — überschreibbar.
// Der Stream-Link erscheint nur bei Livestream (dort Pflicht).

type Kurstyp = { id: string; name: string; studio: number | null; livestream: number | null };
type Modus = "Studio" | "Livestream";

export function KursVorschlagFormular({
  kurstypen,
  schlageVor,
}: {
  kurstypen: Kurstyp[];
  schlageVor: (formData: FormData) => Promise<void>;
}) {
  const standard = (id: string, m: Modus): number | null => {
    const kt = kurstypen.find((k) => k.id === id);
    return m === "Studio" ? (kt?.studio ?? null) : (kt?.livestream ?? null);
  };

  const [kurstypId, setKurstypId] = useState(kurstypen[0]?.id ?? "");
  const [modus, setModus] = useState<Modus>("Studio");
  const [kapazitaet, setKapazitaet] = useState(() => {
    const std = standard(kurstypen[0]?.id ?? "", "Studio");
    return std != null ? String(std) : "";
  });

  // Kapazität aus dem Standard vorbelegen (nur wenn einer hinterlegt ist).
  function vorbelegen(id: string, m: Modus) {
    const std = standard(id, m);
    if (std != null) setKapazitaet(String(std));
  }

  const aktuellerStandard = standard(kurstypId, modus);

  return (
    <form
      action={schlageVor}
      className="mt-6 flex flex-col gap-3 rounded-card border border-gray-200 p-4"
    >
      <h2 className="font-medium text-ink">Kurs vorschlagen</h2>
      <p className="text-xs text-muted">
        Nach dem Vorschlagen gibt der Admin den Kurs frei — erst dann ist er für Mitglieder
        buchbar.
      </p>

      <label className="flex flex-col gap-1 text-sm text-muted">
        Kursart
        <select
          name="kurstypId"
          required
          value={kurstypId}
          onChange={(e) => {
            setKurstypId(e.target.value);
            vorbelegen(e.target.value, modus);
          }}
          className="input"
        >
          {kurstypen.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-muted">
        Modus
        <select
          name="modus"
          required
          value={modus}
          onChange={(e) => {
            const m = e.target.value as Modus;
            setModus(m);
            vorbelegen(kurstypId, m);
          }}
          className="input"
        >
          <option value="Studio">Studio</option>
          <option value="Livestream">Livestream</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-muted">
        Start
        <input type="datetime-local" name="start" required className="input" />
      </label>

      <label className="flex flex-col gap-1 text-sm text-muted">
        Kapazität
        <input
          type="number"
          name="kapazitaet"
          min={1}
          required
          value={kapazitaet}
          onChange={(e) => setKapazitaet(e.target.value)}
          className="input"
        />
        <span className="text-xs text-muted">
          {aktuellerStandard != null
            ? `Standard für ${modus}: ${aktuellerStandard} — anpassbar.`
            : "Kein Standard hinterlegt — bitte Kapazität eingeben."}
        </span>
      </label>

      {modus === "Livestream" && (
        <label className="flex flex-col gap-1 text-sm text-muted">
          Stream-Link
          <input type="url" name="streamLink" required placeholder="https://…" className="input" />
        </label>
      )}

      <button type="submit" className="btn btn-primary btn-block">
        Kurs vorschlagen
      </button>
    </form>
  );
}
