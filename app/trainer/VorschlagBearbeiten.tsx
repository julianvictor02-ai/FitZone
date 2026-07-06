"use client";

import { useState } from "react";

// FZ-026 — Trainer bearbeitet einen eigenen, noch nicht freigegebenen Vorschlag oder zieht
// ihn zurück. Felder vorbelegt; Stream-Link nur bei Livestream. Durchsetzung server-seitig
// (Besitz + Status vorgeschlagen) in der Engine.

type Kurstyp = { id: string; name: string };
type Modus = "Studio" | "Livestream";
type Vorschlag = {
  kursterminId: string;
  kurstypId: string;
  modus: Modus;
  start: Date;
  dauerMinuten: number | null;
  kapazitaet: number;
  streamLink: string | null;
};

// Date → "YYYY-MM-DDTHH:mm" (lokale Zeit) für <input type="datetime-local">.
function datetimeLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function VorschlagBearbeiten({
  vorschlag,
  kurstypen,
  bearbeiten,
  zurueckziehen,
}: {
  vorschlag: Vorschlag;
  kurstypen: Kurstyp[];
  bearbeiten: (formData: FormData) => Promise<void>;
  zurueckziehen: (formData: FormData) => Promise<void>;
}) {
  const [modus, setModus] = useState<Modus>(vorschlag.modus);

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <form action={bearbeiten} className="flex flex-col gap-3">
        <input type="hidden" name="kursterminId" value={vorschlag.kursterminId} />
        <label className="flex flex-col gap-1 text-sm text-muted">
          Kursart
          <select name="kurstypId" defaultValue={vorschlag.kurstypId} required className="input">
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
            value={modus}
            onChange={(e) => setModus(e.target.value as Modus)}
            required
            className="input"
          >
            <option value="Studio">Studio</option>
            <option value="Livestream">Livestream</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Start
          <input
            type="datetime-local"
            name="start"
            defaultValue={datetimeLocal(vorschlag.start)}
            required
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Dauer (Minuten)
          <input
            type="number"
            name="dauerMinuten"
            min={1}
            defaultValue={vorschlag.dauerMinuten ?? ""}
            required
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Kapazität
          <input
            type="number"
            name="kapazitaet"
            min={1}
            defaultValue={vorschlag.kapazitaet}
            required
            className="input"
          />
        </label>
        {modus === "Livestream" && (
          <label className="flex flex-col gap-1 text-sm text-muted">
            Stream-Link
            <input
              type="url"
              name="streamLink"
              defaultValue={vorschlag.streamLink ?? ""}
              required
              placeholder="https://…"
              className="input"
            />
          </label>
        )}
        <button type="submit" className="btn btn-outline btn-block">
          Änderungen speichern
        </button>
      </form>

      <form action={zurueckziehen} className="mt-2">
        <input type="hidden" name="kursterminId" value={vorschlag.kursterminId} />
        <button type="submit" className="btn btn-danger btn-block">
          Vorschlag zurückziehen
        </button>
      </form>
    </div>
  );
}
