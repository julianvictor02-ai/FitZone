import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { requireRolle } from "@/lib/auth/benutzer";
import { db } from "@/lib/db";
import {
  buchung,
  kurstermin,
  kurstyp,
  mitglied,
  tarif,
  wartelisteneintrag,
} from "@/lib/db/schema";

// FZ-007 — Mitglieder-Selbstansicht (read-only). Zeigt Stammdaten, eigene Buchungen/
// Historie und aktiven Wartelisten-Status. Strikt nur eigene Daten (§2b): jede Query
// filtert auf mitglied_id = Session-Mitglied. Keine fremden Namen. Keine Mutationen —
// Tarif/Status/Pausieren bleiben Admin-Sache (FZ-017 killed).

const AKTIV = ["wartend", "benachrichtigt"] as const;

const DATUM = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const DATUM_ZEIT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const DATUM_TAG = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const ANWESENHEIT_LABEL: Record<string, string> = {
  anwesend: "Anwesend",
  no_show: "No-Show",
  entschuldigt: "Entschuldigt",
};
const WL_LABEL: Record<string, string> = {
  wartend: "Wartend",
  benachrichtigt: "Platz frei — bitte bestätigen",
};

export default async function MeinBereichPage() {
  const me = await requireRolle("mitglied");
  if (!me.mitgliedId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold">Mein Bereich</h1>
        <p className="mt-3 text-sm text-red-700">
          Deinem Konto ist kein Mitglied-Profil zugeordnet. Bitte an den Admin wenden.
        </p>
      </main>
    );
  }
  const mitgliedId = me.mitgliedId;

  const [stamm] = await db
    .select({
      name: mitglied.name,
      status: mitglied.status,
      bis: mitglied.mitgliedschaftBis,
      tarif: tarif.name,
    })
    .from(mitglied)
    .innerJoin(tarif, eq(mitglied.tarifId, tarif.tarifId))
    .where(eq(mitglied.mitgliedId, mitgliedId));

  // Eigene Buchungen inkl. Historie (bestätigt + storniert), jüngste zuerst.
  const buchungen = await db
    .select({
      kurstyp: kurstyp.name,
      modus: kurstermin.modus,
      start: kurstermin.start,
      terminStatus: kurstermin.status,
      status: buchung.buchungsstatus,
      zeitpunkt: buchung.buchungszeitpunkt,
      anwesenheit: buchung.anwesenheit,
      stornozeitpunkt: buchung.stornozeitpunkt,
      gebuehr: buchung.stornoGebuehrFaellig,
    })
    .from(buchung)
    .innerJoin(kurstermin, eq(buchung.kursterminId, kurstermin.kursterminId))
    .innerJoin(kurstyp, eq(kurstermin.kurstypId, kurstyp.kurstypId))
    .where(eq(buchung.mitgliedId, mitgliedId))
    .orderBy(desc(kurstermin.start));

  // Aktive Wartelisten-Einträge des Mitglieds.
  const meineWl = await db
    .select({
      kursterminId: wartelisteneintrag.kursterminId,
      kurstyp: kurstyp.name,
      modus: kurstermin.modus,
      start: kurstermin.start,
      status: wartelisteneintrag.status,
      fristBis: wartelisteneintrag.fristBis,
    })
    .from(wartelisteneintrag)
    .innerJoin(kurstermin, eq(wartelisteneintrag.kursterminId, kurstermin.kursterminId))
    .innerJoin(kurstyp, eq(kurstermin.kurstypId, kurstyp.kurstypId))
    .where(and(eq(wartelisteneintrag.mitgliedId, mitgliedId), inArray(wartelisteneintrag.status, [...AKTIV])))
    .orderBy(asc(wartelisteneintrag.zeitstempel));

  // FIFO-Position je Termin: alle aktiven Einträge der betroffenen Termine nach
  // zeitstempel; der Index des eigenen Eintrags + 1 ist die Position (BR3).
  const wlIds = meineWl.map((w) => w.kursterminId);
  const alleAktiv = wlIds.length
    ? await db
        .select({ kursterminId: wartelisteneintrag.kursterminId, mitgliedId: wartelisteneintrag.mitgliedId })
        .from(wartelisteneintrag)
        .where(and(inArray(wartelisteneintrag.kursterminId, wlIds), inArray(wartelisteneintrag.status, [...AKTIV])))
        .orderBy(asc(wartelisteneintrag.zeitstempel))
    : [];
  const reihenfolge = new Map<string, string[]>();
  for (const e of alleAktiv) {
    const arr = reihenfolge.get(e.kursterminId) ?? [];
    arr.push(e.mitgliedId);
    reihenfolge.set(e.kursterminId, arr);
  }
  const position = (kursterminId: string) =>
    (reihenfolge.get(kursterminId)?.indexOf(mitgliedId) ?? -1) + 1;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Mein Bereich</h1>
      <p className="mt-1 text-sm text-gray-500">
        Nur lesend. Tarif/Status ändert der Admin.{" "}
        <Link href="/kurse" className="underline">
          Zu den Kursen
        </Link>
      </p>

      {/* Stammdaten */}
      <section className="mt-8 rounded border border-gray-200 p-4">
        <h2 className="text-lg font-semibold">{stamm?.name}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-gray-500">Tarif</dt>
            <dd className="font-medium">{stamm?.tarif}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd className="font-medium">{stamm?.status}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Mitgliedschaft bis</dt>
            <dd className="font-medium">
              {stamm?.bis ? DATUM_TAG.format(new Date(stamm.bis)) : "unbefristet"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Warteliste */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Warteliste</h2>
        <ul className="mt-3 divide-y divide-gray-100">
          {meineWl.map((w) => (
            <li key={w.kursterminId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-sm">
                {w.kurstyp} <span className="text-gray-500">· {w.modus} · {DATUM.format(w.start)} Uhr</span>
              </span>
              <span className="text-sm text-gray-600">
                {WL_LABEL[w.status] ?? w.status}
                {w.status === "wartend" && ` · Position ${position(w.kursterminId)}`}
                {w.status === "benachrichtigt" && w.fristBis &&
                  ` (bis ${w.fristBis.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })})`}
              </span>
            </li>
          ))}
          {meineWl.length === 0 && (
            <li className="py-2 text-sm text-gray-500">Du stehst auf keiner Warteliste.</li>
          )}
        </ul>
      </section>

      {/* Buchungen / Historie */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Meine Buchungen</h2>
        <ul className="mt-3 divide-y divide-gray-200">
          {buchungen.map((b, i) => {
            const storniert = b.status === "storniert";
            return (
              <li key={i} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {b.kurstyp}{" "}
                    <span className="text-sm font-normal text-gray-500">
                      · {b.modus} · {DATUM.format(b.start)} Uhr
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    {/* Kursausfall/-verschiebung (FZ-009/BR8) — für nicht stornierte Buchungen. */}
                    {!storniert && b.terminStatus === "abgesagt" && (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">
                        Kurs abgesagt
                      </span>
                    )}
                    {!storniert && b.terminStatus === "verschoben" && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
                        Kurs verschoben
                      </span>
                    )}
                    <span className={storniert ? "text-gray-500" : "text-green-700"}>
                      {storniert ? "Storniert" : "Bestätigt"}
                    </span>
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Gebucht am {DATUM_ZEIT.format(b.zeitpunkt)} Uhr
                  {b.anwesenheit !== "offen" && ` · ${ANWESENHEIT_LABEL[b.anwesenheit] ?? b.anwesenheit}`}
                  {storniert && b.stornozeitpunkt &&
                    ` · storniert am ${DATUM_ZEIT.format(b.stornozeitpunkt)} Uhr`}
                  {storniert && b.gebuehr && " · Stornogebühr fällig"}
                </div>
              </li>
            );
          })}
          {buchungen.length === 0 && (
            <li className="py-3 text-sm text-gray-500">Noch keine Buchungen.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
