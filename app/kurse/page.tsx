import Link from "next/link";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { requireRolle } from "@/lib/auth/benutzer";
import { db } from "@/lib/db";
import { buchung, kurstermin, kurstyp, trainer } from "@/lib/db/schema";
import { BuchenButton } from "./BuchenButton";

const DATUM = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function KursePage({
  searchParams,
}: {
  searchParams: Promise<{ modus?: string }>;
}) {
  const me = await requireRolle("mitglied");
  if (!me.mitgliedId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold">Kurse buchen</h1>
        <p className="mt-3 text-sm text-red-700">
          Deinem Konto ist kein Mitglied-Profil zugeordnet. Bitte an den Admin wenden.
        </p>
      </main>
    );
  }
  const mitgliedId = me.mitgliedId;

  const { modus } = await searchParams;
  const modusFilter = modus === "Studio" || modus === "Livestream" ? modus : null;

  const bedingungen = [
    eq(kurstermin.status, "geplant"),
    gt(kurstermin.start, new Date()),
  ];
  if (modusFilter) bedingungen.push(eq(kurstermin.modus, modusFilter));

  const termine = await db
    .select({
      kursterminId: kurstermin.kursterminId,
      kurstyp: kurstyp.name,
      trainer: trainer.name,
      modus: kurstermin.modus,
      start: kurstermin.start,
      kapazitaet: kurstermin.kapazitaet,
    })
    .from(kurstermin)
    .innerJoin(kurstyp, eq(kurstermin.kurstypId, kurstyp.kurstypId))
    .innerJoin(trainer, eq(kurstermin.trainerId, trainer.trainerId))
    .where(and(...bedingungen))
    .orderBy(asc(kurstermin.start));

  const ids = termine.map((t) => t.kursterminId);

  // Belegung (nur bestätigte Buchungen) und eigene Buchungen in je einer Abfrage.
  const belegung = ids.length
    ? await db
        .select({
          kursterminId: buchung.kursterminId,
          anzahl: sql<number>`count(*)::int`,
        })
        .from(buchung)
        .where(
          and(
            inArray(buchung.kursterminId, ids),
            eq(buchung.buchungsstatus, "bestaetigt"),
          ),
        )
        .groupBy(buchung.kursterminId)
    : [];
  const belegungMap = new Map(belegung.map((b) => [b.kursterminId, b.anzahl]));

  const meine = ids.length
    ? await db
        .select({ kursterminId: buchung.kursterminId })
        .from(buchung)
        .where(
          and(
            inArray(buchung.kursterminId, ids),
            eq(buchung.mitgliedId, mitgliedId),
            eq(buchung.buchungsstatus, "bestaetigt"),
          ),
        )
    : [];
  const meineSet = new Set(meine.map((m) => m.kursterminId));

  const filterLink = (wert: string | null) =>
    wert ? `/kurse?modus=${wert}` : "/kurse";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Kurse buchen</h1>
      <p className="mt-1 text-sm text-gray-500">
        Freie Plätze werden nur als Anzahl angezeigt (keine Teilnehmernamen).
      </p>

      {/* Modus-Filter */}
      <nav className="mt-4 flex gap-2 text-sm">
        {[
          { label: "Alle", wert: null },
          { label: "Studio", wert: "Studio" },
          { label: "Livestream", wert: "Livestream" },
        ].map((f) => (
          <Link
            key={f.label}
            href={filterLink(f.wert)}
            className={`rounded border px-3 py-1 ${
              modusFilter === f.wert || (!modusFilter && f.wert === null)
                ? "border-black bg-black text-white"
                : "border-gray-300"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <ul className="mt-6 divide-y divide-gray-200">
        {termine.map((t) => {
          const belegt = belegungMap.get(t.kursterminId) ?? 0;
          const frei = Math.max(0, t.kapazitaet - belegt);
          return (
            <li
              key={t.kursterminId}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div>
                <div className="font-medium">
                  {t.kurstyp}{" "}
                  <span className="text-sm font-normal text-gray-500">
                    · {t.modus}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {DATUM.format(t.start)} Uhr · {t.trainer} ·{" "}
                  <span className={frei === 0 ? "text-amber-700" : ""}>
                    {frei} von {t.kapazitaet} frei
                  </span>
                </div>
              </div>
              <BuchenButton
                kursterminId={t.kursterminId}
                bereitsGebucht={meineSet.has(t.kursterminId)}
              />
            </li>
          );
        })}
        {termine.length === 0 && (
          <li className="py-4 text-sm text-gray-500">
            Keine buchbaren Kurstermine{modusFilter ? ` (${modusFilter})` : ""}.
          </li>
        )}
      </ul>
    </main>
  );
}
