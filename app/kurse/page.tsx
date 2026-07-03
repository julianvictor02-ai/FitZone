import Link from "next/link";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { requireRolle } from "@/lib/auth/benutzer";
import { db } from "@/lib/db";
import {
  buchung,
  kurstermin,
  kurstyp,
  mitglied,
  tarif,
  trainer,
  wartelisteneintrag,
} from "@/lib/db/schema";
import { MAX_WARTELISTE } from "@/lib/booking/warteliste";
import { stornoGebuehrFaellig } from "@/lib/booking/storno";
import { KursterminAktion, type Zustand } from "./KursterminAktion";

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

  // Tarif-Befreiung für den Stornogebühr-Hinweis (BR5).
  const [tarifInfo] = await db
    .select({ befreit: tarif.stornoGebuehrBefreit })
    .from(mitglied)
    .innerJoin(tarif, eq(mitglied.tarifId, tarif.tarifId))
    .where(eq(mitglied.mitgliedId, mitgliedId));
  const stornoBefreit = tarifInfo?.befreit ?? false;

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

  const belegung = ids.length
    ? await db
        .select({ kursterminId: buchung.kursterminId, anzahl: sql<number>`count(*)::int` })
        .from(buchung)
        .where(and(inArray(buchung.kursterminId, ids), eq(buchung.buchungsstatus, "bestaetigt")))
        .groupBy(buchung.kursterminId)
    : [];
  const belegungMap = new Map(belegung.map((b) => [b.kursterminId, b.anzahl]));

  const meineBuchungen = ids.length
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
  const gebuchtSet = new Set(meineBuchungen.map((m) => m.kursterminId));

  // Aktive Warteliste (FIFO nach zeitstempel) für alle gelisteten Termine.
  const wlAktiv = ids.length
    ? await db
        .select({
          kursterminId: wartelisteneintrag.kursterminId,
          mitgliedId: wartelisteneintrag.mitgliedId,
          status: wartelisteneintrag.status,
          fristBis: wartelisteneintrag.fristBis,
        })
        .from(wartelisteneintrag)
        .where(
          and(
            inArray(wartelisteneintrag.kursterminId, ids),
            inArray(wartelisteneintrag.status, ["wartend", "benachrichtigt"]),
          ),
        )
        .orderBy(asc(wartelisteneintrag.zeitstempel))
    : [];
  const wlMap = new Map<string, typeof wlAktiv>();
  for (const e of wlAktiv) {
    let arr = wlMap.get(e.kursterminId);
    if (!arr) {
      arr = [];
      wlMap.set(e.kursterminId, arr);
    }
    arr.push(e);
  }

  const filterLink = (wert: string | null) => (wert ? `/kurse?modus=${wert}` : "/kurse");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Kurse buchen</h1>
      <p className="mt-1 text-sm text-gray-500">
        Freie Plätze als Anzahl (keine Namen). Volle Kurse: Warteliste (max.{" "}
        {MAX_WARTELISTE}, FIFO).
      </p>

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
          const wl = wlMap.get(t.kursterminId) ?? [];
          const meinIdx = wl.findIndex((e) => e.mitgliedId === mitgliedId);
          const mein = meinIdx >= 0 ? wl[meinIdx] : null;

          let zustand: Zustand;
          let position: number | undefined;
          let fristBisISO: string | undefined;
          if (gebuchtSet.has(t.kursterminId)) {
            zustand = "gebucht";
          } else if (mein?.status === "benachrichtigt") {
            zustand = "benachrichtigt";
            fristBisISO = mein.fristBis?.toISOString();
          } else if (mein?.status === "wartend") {
            zustand = "wartend";
            position = meinIdx + 1;
          } else if (frei > 0) {
            zustand = "buchbar";
          } else {
            zustand = wl.length >= MAX_WARTELISTE ? "warteliste_voll" : "voll";
          }

          return (
            <li
              key={t.kursterminId}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div>
                <div className="font-medium">
                  {t.kurstyp}{" "}
                  <span className="text-sm font-normal text-gray-500">· {t.modus}</span>
                </div>
                <div className="text-sm text-gray-500">
                  {DATUM.format(t.start)} Uhr · {t.trainer} ·{" "}
                  <span className={frei === 0 ? "text-amber-700" : ""}>
                    {frei} von {t.kapazitaet} frei
                  </span>
                  {frei === 0 && wl.length > 0 && (
                    <span> · Warteliste {wl.length}/{MAX_WARTELISTE}</span>
                  )}
                </div>
              </div>
              <KursterminAktion
                kursterminId={t.kursterminId}
                zustand={zustand}
                position={position}
                fristBisISO={fristBisISO}
                stornoGebuehrDroht={
                  zustand === "gebucht"
                    ? stornoGebuehrFaellig(t.start, stornoBefreit)
                    : undefined
                }
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
