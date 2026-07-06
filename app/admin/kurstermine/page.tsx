import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { buchung, kurstermin, kurstyp, trainer, wartelisteneintrag } from "@/lib/db/schema";
import { requireRolle } from "@/lib/auth/benutzer";
import { sageAb, verschiebe, gibFrei, lehneAb } from "./actions";

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

  // FZ-020 — offene Trainer-Vorschläge (warten auf Freigabe).
  const vorschlaege = await db
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
    .where(eq(kurstermin.status, "vorgeschlagen"))
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
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Kurstermin-Verwaltung</h1>
        <p className="subtitle">
          Absagen oder verschieben — betroffene Mitglieder (Buchung + Warteliste) werden
          automatisch benachrichtigt (FZ-009, BR8).
        </p>
      </header>

      {/* FZ-020 — Trainer-Vorschläge freigeben (dann für Mitglieder buchbar) oder ablehnen. */}
      <section>
        <h2 className="section-title">Freigabe ausstehend</h2>
        <p className="-mt-2 mb-3 text-sm text-muted">
          Von Trainern vorgeschlagene Kurse. Nach Freigabe erscheinen sie in der Kursliste
          der Mitglieder (FZ-020).
        </p>
        <ul className="stack">
          {vorschlaege.map((v) => (
            <li key={v.kursterminId} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-ink">
                    {v.kurstyp}{" "}
                    <span className="text-sm font-normal text-muted">· {v.modus}</span>
                  </div>
                  <div className="text-sm text-muted">
                    {DATUM.format(v.start)} Uhr · {v.trainer} · {v.kapazitaet} Plätze
                  </div>
                </div>
                <span className="badge badge-success shrink-0">Vorschlag</span>
              </div>
              <div className="mt-3 flex gap-3">
                <form action={gibFrei} className="flex-1">
                  <input type="hidden" name="kursterminId" value={v.kursterminId} />
                  <button type="submit" className="btn btn-primary btn-block">
                    Freigeben
                  </button>
                </form>
                <form action={lehneAb} className="flex-1">
                  <input type="hidden" name="kursterminId" value={v.kursterminId} />
                  <button type="submit" className="btn btn-outline btn-block">
                    Ablehnen
                  </button>
                </form>
              </div>
            </li>
          ))}
          {vorschlaege.length === 0 && <li className="empty">Keine offenen Vorschläge.</li>}
        </ul>
      </section>

      <section className="section">
        <h2 className="section-title">Anstehende Termine</h2>
        <ul className="stack">
          {termine.map((t) => {
            const gebucht = belegungMap.get(t.kursterminId) ?? 0;
            const wl = wlMap.get(t.kursterminId) ?? 0;
            return (
              <li key={t.kursterminId} className="card">
                <div className="font-medium text-ink">
                  {t.kurstyp}{" "}
                  <span className="text-sm font-normal text-muted">· {t.modus}</span>
                  {t.status === "verschoben" && (
                    <span className="badge badge-warn ml-2">{STATUS_LABEL[t.status]}</span>
                  )}
                </div>
                <div className="text-sm text-muted">
                  {DATUM.format(t.start)} Uhr · {t.trainer} · {gebucht} gebucht
                  {wl > 0 && ` · ${wl} Warteliste`}
                </div>

              <div className="mt-3 flex flex-col gap-3">
                {/* Verschieben — nur aus geplant zulässig (spec §2). */}
                {t.status === "geplant" && (
                  <form action={verschiebe} className="flex flex-col gap-2">
                    <input type="hidden" name="kursterminId" value={t.kursterminId} />
                    <label className="flex flex-col gap-1 text-sm text-muted">
                      Neuer Start
                      <input
                        type="datetime-local"
                        name="neuerStart"
                        required
                        defaultValue={datetimeLocal(t.start)}
                        className="input"
                      />
                    </label>
                    <button type="submit" className="btn btn-outline btn-block">
                      Verschieben
                    </button>
                  </form>
                )}

                {/* Absagen — aus geplant und verschoben zulässig. */}
                <form action={sageAb}>
                  <input type="hidden" name="kursterminId" value={t.kursterminId} />
                  <button type="submit" className="btn btn-danger btn-block">
                    Absagen
                  </button>
                </form>
              </div>
              </li>
            );
          })}
          {termine.length === 0 && <li className="empty">Keine anstehenden Kurstermine.</li>}
        </ul>
      </section>
    </main>
  );
}
