import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { requireRolle } from "@/lib/auth/benutzer";
import { PushEinstellung } from "@/components/PushEinstellung";
import { FristCountdown } from "@/components/FristCountdown";
import { aktivierePushAction, deaktivierePushAction } from "./actions";
import { db } from "@/lib/db";
import {
  buchung,
  kurstermin,
  kurstyp,
  mitglied,
  tarif,
  wartelisteneintrag,
} from "@/lib/db/schema";
import {
  kursIcon,
  Hourglass,
  CheckCircle,
  XCircle,
  Ban,
  Clock,
  CalendarX,
  Compass,
  User,
} from "@/components/icons";

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
const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

const ANWESENHEIT_LABEL: Record<string, string> = {
  anwesend: "Anwesend",
  no_show: "No-Show",
  entschuldigt: "Entschuldigt",
};

export default async function MeinBereichPage() {
  const me = await requireRolle("mitglied");
  if (!me.mitgliedId) {
    return (
      <main className="page">
        <h1 className="text-2xl font-bold text-ink">Mein Bereich</h1>
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
      betrag: buchung.stornoGebuehrBetrag,
      gebuehrEntscheidung: buchung.stornoGebuehrEntscheidung,
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
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Mein Bereich</h1>
        <p className="subtitle">
          Nur lesend — Tarif und Status ändert der Admin.{" "}
          <Link href="/kurse">Zu den Kursen</Link>
        </p>
      </header>

      {/* Stammdaten */}
      <section className="card">
        <div className="flex items-center gap-3">
          <div className="icon-tile" style={{ width: 48, height: 48 }}>
            <User />
          </div>
          <h2 className="text-xl font-bold text-ink leading-tight">{stamm?.name}</h2>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Tarif</dt>
            <dd className="mt-0.5">
              <span className="badge badge-success">{stamm?.tarif}</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Status</dt>
            <dd className="mt-0.5">
              <span className={`badge ${stamm?.status === "aktiv" ? "badge-success" : "badge-muted"}`}>
                {stamm?.status === "aktiv" ? <CheckCircle /> : <Ban />}
                {stamm?.status}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Mitgliedschaft bis</dt>
            <dd className="mt-0.5 font-medium text-ink">
              {stamm?.bis ? DATUM_TAG.format(new Date(stamm.bis)) : "unbefristet"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Benachrichtigungen (FZ-019) */}
      <PushEinstellung
        vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
        aktiviereAbo={aktivierePushAction}
        deaktiviereAbo={deaktivierePushAction}
      />

      {/* Warteliste */}
      <section className="section">
        <h2 className="section-title">Warteliste</h2>
        {meineWl.length === 0 ? (
          <p className="empty">
            <span className="empty-icon">
              <Hourglass />
            </span>
            <span>Du stehst auf keiner Warteliste.</span>
          </p>
        ) : (
          <ul className="stack">
            {meineWl.map((w) => {
              const KI = kursIcon(w.kurstyp);
              return (
                <li key={w.kursterminId} className="card">
                  <div className="flex items-start gap-3">
                    <div className="icon-tile">
                      <KI />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-ink leading-tight">{w.kurstyp}</div>
                      <div className="mt-1 text-sm text-muted">
                        {w.modus} · {DATUM.format(w.start)} Uhr
                      </div>
                      <div className="mt-2">
                        <span
                          className={`badge ${
                            w.status === "benachrichtigt" ? "badge-success" : "badge-warn"
                          }`}
                        >
                          {w.status === "benachrichtigt" ? <CheckCircle /> : <Hourglass />}
                          {w.status === "wartend"
                            ? `Warteliste · Platz ${position(w.kursterminId)}`
                            : "Platz frei"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {w.status === "benachrichtigt" && w.fristBis && (
                    <p className="hinweis hinweis-ok mt-3">
                      <CheckCircle /> Bitte bestätigen (
                      <FristCountdown bisISO={w.fristBis.toISOString()} />, bis{" "}
                      {w.fristBis.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}{" "}
                      Uhr) unter &bdquo;Kurse&ldquo;.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Buchungen / Historie */}
      <section className="section">
        <h2 className="section-title">Meine Buchungen</h2>
        {buchungen.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">
              <CalendarX />
            </span>
            <span>Noch keine Buchungen.</span>
            <Link href="/kurse" className="btn btn-primary">
              <Compass /> Kurs finden
            </Link>
          </div>
        ) : (
          <ul className="stack">
            {buchungen.map((b, i) => {
              const storniert = b.status === "storniert";
              const KI = kursIcon(b.kurstyp);
              return (
                <li key={i} className="card">
                  <div className="flex items-start gap-3">
                    <div className="icon-tile">
                      <KI />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-ink leading-tight">{b.kurstyp}</div>
                      <div className="mt-1 text-sm text-muted">
                        {b.modus} · {DATUM.format(b.start)} Uhr
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {/* Kursausfall/-verschiebung (FZ-009/BR8) — für nicht stornierte Buchungen. */}
                        {!storniert && b.terminStatus === "abgesagt" && (
                          <span className="badge badge-danger">
                            <Ban /> Kurs abgesagt
                          </span>
                        )}
                        {!storniert && b.terminStatus === "verschoben" && (
                          <span className="badge badge-warn">
                            <Clock /> Kurs verschoben
                          </span>
                        )}
                        <span className={`badge ${storniert ? "badge-muted" : "badge-success"}`}>
                          {storniert ? <XCircle /> : <CheckCircle />}
                          {storniert ? "Storniert" : "Bestätigt"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted">
                    Gebucht am {DATUM_ZEIT.format(b.zeitpunkt)} Uhr
                    {b.anwesenheit !== "offen" &&
                      ` · ${ANWESENHEIT_LABEL[b.anwesenheit] ?? b.anwesenheit}`}
                    {storniert && b.stornozeitpunkt &&
                      ` · storniert am ${DATUM_ZEIT.format(b.stornozeitpunkt)} Uhr`}
                    {storniert && b.gebuehr &&
                      (b.gebuehrEntscheidung === "erlassen"
                        ? " · Stornogebühr erlassen"
                        : ` · Stornogebühr fällig${b.betrag != null ? ` (${EUR.format(Number(b.betrag))})` : ""}`)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
