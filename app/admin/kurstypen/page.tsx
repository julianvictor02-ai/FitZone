import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { kurstyp } from "@/lib/db/schema";
import { requireRolle } from "@/lib/auth/benutzer";
import { STORNO_GEBUEHR_ANTEIL } from "@/lib/booking/storno";
import { setzeEinzelpreis } from "./actions";

// FZ-016 — Einzelkurs-Preise je Kursart (Basis der Stornogebühr = 50 %).

const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export default async function KurstypenPage() {
  await requireRolle("admin");

  const typen = await db
    .select({
      kurstypId: kurstyp.kurstypId,
      name: kurstyp.name,
      einzelpreis: kurstyp.einzelpreis,
    })
    .from(kurstyp)
    .orderBy(asc(kurstyp.name));

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Kurspreise</h1>
      <p className="mt-1 text-sm text-gray-500">
        Einzelkurs-Preis je Kursart. Basis der Stornogebühr: bei zu kurzfristiger Absage werden{" "}
        {Math.round(STORNO_GEBUEHR_ANTEIL * 100)} % berechnet (FZ-016). Ohne Preis bleibt es beim
        Gebühren-Vermerk ohne Betrag.
      </p>

      <ul className="mt-8 divide-y divide-gray-200">
        {typen.map((t) => {
          const preis = t.einzelpreis != null ? Number(t.einzelpreis) : null;
          return (
            <li key={t.kurstypId} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-sm text-gray-500">
                  {preis != null
                    ? `${EUR.format(preis)} · Stornogebühr ${EUR.format(preis * STORNO_GEBUEHR_ANTEIL)}`
                    : "kein Preis hinterlegt"}
                </div>
              </div>
              <form action={setzeEinzelpreis} className="flex items-end gap-2">
                <input type="hidden" name="kurstypId" value={t.kurstypId} />
                <label className="flex flex-col gap-1 text-xs">
                  Einzelpreis (€)
                  <input
                    type="number"
                    name="einzelpreis"
                    min="0"
                    step="0.01"
                    defaultValue={preis != null ? String(preis) : ""}
                    className="w-28 rounded border border-gray-300 px-2 py-1"
                  />
                </label>
                <button type="submit" className="rounded border border-gray-400 px-3 py-1 text-xs">
                  Speichern
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
