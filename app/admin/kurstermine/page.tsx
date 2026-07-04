import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { buchung, kurstermin, kurstyp, trainer, wartelisteneintrag } from "@/lib/db/schema";
import { requireRolle } from "@/lib/auth/benutzer";
import { sageAb, verschiebe } from "./actions";

// FZ-009 — Admin-Terminverwaltung: Absagen/Verschieben mit Auto-Benachrichtigung (BR8).

const DATUM = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Startzeitpunkt als Default für <input type="datetime-local"> (lokale Zeit, YYYY-MM-DDTHH:mm).
function datetimeLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const STATUS_LABEL: Record<string, string> = {
  geplant: "Geplant",
  verschoben: "Verschoben",
  abgesagt: "Abgesagt",
};

export default async function KurstermineAdminPage() {
  await requireRolle("admin");

  // Anstehende, noch nicht abgesagte Termine (geplant + verschoben).
  const termine = await db
    .select({
      kursterminId: kurstermin.kursterminId,
      kurstyp: kurstyp.name,
      trainer: trainer.name,
      modus: kurstermin.modus,
      start: kurstermin.start,
      status: kurstermin.status,
    })
    .from(kurstermin)
    .innerJoin(kurstyp, eq(kurstermin.kurstypId, kurstyp.kurstypId))
    .innerJoin(trainer, eq(kurstermin.trainerId, trainer.trainerId))
    .where(
      and(
        inArray(kurstermin.status, ["geplant", "verschoben"]),
        gt(kurstermin.start, new Date()),
      ),
    )
    .orderBy(asc(kurstermin.start));

  const ids = termine.map((t) => t.kursterminId);

  // Betroffene je Termin: bestätigte Buchungen + aktive Warteliste (= Empfänger BR8).
  const belegung = ids.length
    ? await db
        .select({ kursterminId: buchung.kursterminId, anzahl: sql<number>`count(*)::int` })
        .from(buchung)
        .where(and(inArray(buchung.kursterminId, ids), eq(buchung.buchungsstatus, "bestaetigt")))
        .groupBy(buchung.kursterminId)
    : [];
  const belegungMap = new Map(belegung.map((b) => [b.kursterminId, b.anzahl]));

  const warteliste = ids.length
    ? await db
        .select({ kursterminId: wartelisteneintrag.kursterminId, anzahl: sql<number>`count(*)::int` })
        .from(wartelisteneintrag)
        .where(
          and(
            inArray(wartelisteneintrag.kursterminId, ids),
            inArray(wartelisteneintrag.status, ["wartend", "benachrichtigt"]),
          ),
        )
        .groupBy(wartelisteneintrag.kursterminId)
    : [];
  const wlMap = new Map(warteliste.map((w) => [w.kursterminId, w.anzahl]));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold">Kurstermin-Verwaltung</h1>
      <p className="mt-1 text-sm text-gray-500">
        Absagen oder verschieben — betroffene Mitglieder (Buchung + Warteliste) werden
        automatisch benachrichtigt (FZ-009, BR8).
      </p>

      <ul className="mt-8 divide-y divide-gray-200">
        {termine.map((t) => {
          const gebucht = belegungMap.get(t.kursterminId) ?? 0;
          const wl = wlMap.get(t.kursterminId) ?? 0;
          return (
            <li key={t.kursterminId} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {t.kurstyp}{" "}
                    <span className="text-sm font-normal text-gray-500">· {t.modus}</span>
                    {t.status === "verschoben" && (
                      <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        {STATUS_LABEL[t.status]}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {DATUM.format(t.start)} Uhr · {t.trainer} · {gebucht} gebucht
                    {wl > 0 && ` · ${wl} Warteliste`}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-end gap-4">
                {/* Verschieben — nur aus geplant zulässig (spec §2). */}
                {t.status === "geplant" && (
                  <form action={verschiebe} className="flex items-end gap-2">
                    <input type="hidden" name="kursterminId" value={t.kursterminId} />
                    <label className="flex flex-col gap-1 text-xs">
                      Neuer Start
                      <input
                        type="datetime-local"
                        name="neuerStart"
                        required
                        defaultValue={datetimeLocal(t.start)}
                        className="rounded border border-gray-300 px-2 py-1"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded border border-gray-400 px-3 py-1 text-xs"
                    >
                      Verschieben
                    </button>
                  </form>
                )}

                {/* Absagen — aus geplant und verschoben zulässig. */}
                <form action={sageAb}>
                  <input type="hidden" name="kursterminId" value={t.kursterminId} />
                  <button
                    type="submit"
                    className="rounded bg-red-600 px-3 py-1 text-xs text-white"
                  >
                    Absagen
                  </button>
                </form>
              </div>
            </li>
          );
        })}
        {termine.length === 0 && (
          <li className="py-4 text-sm text-gray-500">Keine anstehenden Kurstermine.</li>
        )}
      </ul>
    </main>
  );
}
