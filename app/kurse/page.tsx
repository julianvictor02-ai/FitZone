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
import { darfLivestreamBuchen } from "@/lib/content/zugriff";
import { KursterminAktion, type Zustand } from "./KursterminAktion";
import { kursIcon, Users, XCircle, Compass } from "@/components/icons";

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
      <main className="page">
        <h1 className="text-2xl font-bold text-ink">Kurse buchen</h1>
        <p className="mt-3 text-sm text-red-700">
          Deinem Konto ist kein Mitglied-Profil zugeordnet. Bitte an den Admin wenden.
        </p>
      </main>
    );
  }
  const mitgliedId = me.mitgliedId;

  // Tarif-Befreiung für den Stornogebühr-Hinweis (BR5).
  const [tarifInfo] = await db
    .select({ befreit: tarif.stornoGebuehrBefreit, livestream: tarif.livestreamZugriff })
    .from(mitglied)
    .innerJoin(tarif, eq(mitglied.tarifId, tarif.tarifId))
    .where(eq(mitglied.mitgliedId, mitgliedId));
  const stornoBefreit = tarifInfo?.befreit ?? false;
  const livestreamErlaubt = darfLivestreamBuchen(tarifInfo?.livestream ?? null);

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
      dauerMinuten: kurstermin.dauerMinuten,
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
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Kurse buchen</h1>
        <p className="subtitle">
          Volle Kurse werden automatisch zur Warteliste (max. {MAX_WARTELISTE}, FIFO). Es
          werden nur freie Plätze als Zahl gezeigt — keine Namen.
        </p>
      </header>

      <nav className="mb-5 flex gap-2">
        {[
          { label: "Alle", wert: null },
          { label: "Studio", wert: "Studio" },
          { label: "Livestream", wert: "Livestream" },
        ].map((f) => (
          <Link
            key={f.label}
            href={filterLink(f.wert)}
            className={`chip ${
              modusFilter === f.wert || (!modusFilter && f.wert === null) ? "chip-active" : ""
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <ul className="stack">
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

          // Livestream-Gate (BR7/FZ-018): Basic sieht Livestreams gesperrt, sofern
          // nicht bereits gebucht/wartend (Bestandsschutz für Alt-Buchungen).
          if (
            t.modus === "Livestream" &&
            !livestreamErlaubt &&
            (zustand === "buchbar" || zustand === "voll" || zustand === "warteliste_voll")
          ) {
            zustand = "livestream_gesperrt";
          }

          const KursIcon = kursIcon(t.kurstyp);
          return (
            <li key={t.kursterminId} className="card">
              <div className="flex items-start gap-3">
                <div className="icon-tile">
                  <KursIcon />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-ink leading-tight">{t.kurstyp}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {DATUM.format(t.start)} Uhr
                    {t.dauerMinuten != null && ` · ${t.dauerMinuten} Min`}
                  </p>
                  <p className="text-sm text-muted">
                    {t.trainer} · {t.modus}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {frei > 0 ? (
                    <span className="badge badge-frei">
                      <Users /> {frei} frei
                    </span>
                  ) : (
                    <span className="badge badge-warn">
                      <XCircle /> Ausgebucht
                    </span>
                  )}
                  {frei === 0 && wl.length > 0 && (
                    <span className="text-xs text-muted">
                      Warteliste {wl.length}/{MAX_WARTELISTE}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3">
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
              </div>
            </li>
          );
        })}
        {termine.length === 0 && (
          <li className="empty">
            <span className="empty-icon">
              <Compass />
            </span>
            <span>
              Aktuell keine buchbaren Kurstermine{modusFilter ? ` (${modusFilter})` : ""}. Schau
              später wieder vorbei.
            </span>
          </li>
        )}
      </ul>
    </main>
  );
}
