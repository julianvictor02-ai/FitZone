import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { kurstyp } from "@/lib/db/schema";
import { requireRolle } from "@/lib/auth/benutzer";
import { STORNO_GEBUEHR_ANTEIL } from "@/lib/booking/storno";
import { setzeEinzelpreis, setzeStandardKapazitaet } from "./actions";

// FZ-016 — Einzelkurs-Preise je Kursart (Basis der Stornogebühr = 50 %).

const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export default async function KurstypenPage() {
  await requireRolle("admin");

  const typen = await db
    .select({
      kurstypId: kurstyp.kurstypId,
      name: kurstyp.name,
      einzelpreis: kurstyp.einzelpreis,
      standardStudio: kurstyp.standardKapazitaetStudio,
      standardLivestream: kurstyp.standardKapazitaetLivestream,
    })
    .from(kurstyp)
    .orderBy(asc(kurstyp.name));

  return (
    <main className="page">
      <h1 className="text-2xl font-bold text-ink">Kurspreise</h1>
      <p className="mt-1 text-sm text-muted">
        Einzelkurs-Preis je Kursart. Basis der Stornogebühr: bei zu kurzfristiger Absage werden{" "}
        {Math.round(STORNO_GEBUEHR_ANTEIL * 100)} % berechnet (FZ-016). Ohne Preis bleibt es beim
        Gebühren-Vermerk ohne Betrag.
      </p>

      <ul className="mt-8 space-y-3">
        {typen.map((t) => {
          const preis = t.einzelpreis != null ? Number(t.einzelpreis) : null;
          return (
            <li key={t.kurstypId} className="rounded-card border border-gray-200 p-4">
              <div className="font-medium text-ink">{t.name}</div>
              <div className="text-sm text-muted">
                {preis != null
                  ? `${EUR.format(preis)} · Stornogebühr ${EUR.format(preis * STORNO_GEBUEHR_ANTEIL)}`
                  : "kein Preis hinterlegt"}
              </div>
              <form action={setzeEinzelpreis} className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="kurstypId" value={t.kurstypId} />
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Einzelpreis (€)
                  <input
                    type="number"
                    name="einzelpreis"
                    min="0"
                    step="0.01"
                    defaultValue={preis != null ? String(preis) : ""}
                    className="input"
                  />
                </label>
                <button type="submit" className="btn btn-outline btn-block">
                  Speichern
                </button>
              </form>

              {/* FZ-021 — Standard-Kapazität je Modus (Vorbelegung im Trainer-Formular). */}
              <form
                action={setzeStandardKapazitaet}
                className="mt-3 border-t border-gray-100 pt-3"
              >
                <input type="hidden" name="kurstypId" value={t.kurstypId} />
                <div className="text-sm font-medium text-ink">Standard-Kapazität</div>
                <div className="mt-2 flex gap-3">
                  <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
                    Studio
                    <input
                      type="number"
                      name="studio"
                      min="1"
                      defaultValue={t.standardStudio ?? ""}
                      className="input"
                    />
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
                    Livestream
                    <input
                      type="number"
                      name="livestream"
                      min="1"
                      defaultValue={t.standardLivestream ?? ""}
                      className="input"
                    />
                  </label>
                </div>
                <button type="submit" className="btn btn-outline btn-block mt-2">
                  Standard speichern
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
