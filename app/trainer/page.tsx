import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { requireRolle } from "@/lib/auth/benutzer";
import { db } from "@/lib/db";
import { buchung, kurstermin, kurstyp, mitglied } from "@/lib/db/schema";
import { AnwesenheitAktion } from "./AnwesenheitAktion";
import { TrainerNotiz } from "./TrainerNotiz";
import { schlageKursVor } from "./actions";
import type { AnwesenheitWert } from "@/lib/attendance/anwesenheit";

// FZ-005 — Trainer-Login: eigener Kursplan + Anwesenheit abhaken.
// Sichtbarkeit strikt auf eigene Termine begrenzt (§2b): die Query filtert hart auf
// trainer_id = Session-Trainer. Teilnehmernamen sind hier zulässig (Trainer sieht
// Teilnehmer eigener Kurse), anders als in der Mitglieder-Ansicht.

const DATUM = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUS_BADGE: Record<string, string> = {
  verschoben: "text-amber-700",
  geplant: "text-gray-500",
  vorgeschlagen: "text-emerald-700",
};

export default async function TrainerPage() {
  const me = await requireRolle("trainer");
  if (!me.trainerId) {
    return (
      <main className="page">
        <h1 className="text-2xl font-bold text-ink">Mein Kursplan</h1>
        <p className="mt-3 text-sm text-red-700">
          Deinem Konto ist kein Trainer-Profil zugeordnet. Bitte an den Admin wenden.
        </p>
      </main>
    );
  }
  const trainerId = me.trainerId;
  const jetzt = new Date();

  // Kursarten für das Vorschlags-Formular (FZ-020).
  const kurstypen = await db
    .select({ id: kurstyp.kurstypId, name: kurstyp.name })
    .from(kurstyp)
    .orderBy(asc(kurstyp.name));

  // Nur eigene, nicht abgesagte Termine (§2b). Jüngste zuerst — frisch beendete
  // Kurse (Anwesenheit fällig) stehen oben.
  const termine = await db
    .select({
      kursterminId: kurstermin.kursterminId,
      kurstyp: kurstyp.name,
      modus: kurstermin.modus,
      start: kurstermin.start,
      kapazitaet: kurstermin.kapazitaet,
      status: kurstermin.status,
    })
    .from(kurstermin)
    .innerJoin(kurstyp, eq(kurstermin.kurstypId, kurstyp.kurstypId))
    .where(and(eq(kurstermin.trainerId, trainerId), ne(kurstermin.status, "abgesagt")))
    .orderBy(desc(kurstermin.start));

  const ids = termine.map((t) => t.kursterminId);

  // Teilnehmer (bestätigte Buchungen) je Termin, inkl. Anwesenheit. Nur für eigene
  // Termine geladen (ids stammen aus der trainer-gefilterten Query oben).
  const teilnehmer = ids.length
    ? await db
        .select({
          kursterminId: buchung.kursterminId,
          mitgliedId: buchung.mitgliedId,
          name: mitglied.name,
          anwesenheit: buchung.anwesenheit,
          notiz: buchung.trainerNotiz,
        })
        .from(buchung)
        .innerJoin(mitglied, eq(buchung.mitgliedId, mitglied.mitgliedId))
        .where(and(inArray(buchung.kursterminId, ids), eq(buchung.buchungsstatus, "bestaetigt")))
        .orderBy(asc(mitglied.name))
    : [];

  const byTermin = new Map<string, typeof teilnehmer>();
  for (const t of teilnehmer) {
    let arr = byTermin.get(t.kursterminId);
    if (!arr) {
      arr = [];
      byTermin.set(t.kursterminId, arr);
    }
    arr.push(t);
  }

  return (
    <main className="page">
      <h1 className="text-2xl font-bold text-ink">Mein Kursplan</h1>
      <p className="mt-1 text-sm text-muted">
        Nur deine Kurse. Anwesenheit lässt sich ab Kursbeginn abhaken (FZ-005).
      </p>

      {/* FZ-020 — Kurs vorschlagen; erscheint erst nach Admin-Freigabe für Mitglieder. */}
      <form
        action={schlageKursVor}
        className="mt-6 flex flex-col gap-3 rounded-card border border-gray-200 p-4"
      >
        <h2 className="font-medium text-ink">Kurs vorschlagen</h2>
        <p className="text-xs text-muted">
          Nach dem Vorschlagen gibt der Admin den Kurs frei — erst dann ist er für
          Mitglieder buchbar.
        </p>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Kursart
          <select name="kurstypId" required className="input">
            {kurstypen.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Modus
          <select name="modus" required defaultValue="Studio" className="input">
            <option value="Studio">Studio</option>
            <option value="Livestream">Livestream</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Start
          <input type="datetime-local" name="start" required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Kapazität
          <input type="number" name="kapazitaet" min={1} required className="input" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Stream-Link (nur Livestream)
          <input type="url" name="streamLink" placeholder="https://…" className="input" />
        </label>
        <button type="submit" className="btn btn-primary btn-block">
          Kurs vorschlagen
        </button>
      </form>

      <ul className="mt-6 space-y-6">
        {termine.map((t) => {
          const liste = byTermin.get(t.kursterminId) ?? [];
          const erfassbar = t.start <= jetzt;
          return (
            <li key={t.kursterminId} className="rounded-card border border-gray-200 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-medium">
                  {t.kurstyp}{" "}
                  <span className="text-sm font-normal text-gray-500">· {t.modus}</span>
                  {t.status === "verschoben" && (
                    <span className="ml-2 text-xs text-amber-700">(verschoben)</span>
                  )}
                  {t.status === "vorgeschlagen" && (
                    <span className="ml-2 text-xs text-emerald-700">(wartet auf Freigabe)</span>
                  )}
                </div>
                <div className={`text-sm ${STATUS_BADGE[t.status] ?? "text-gray-500"}`}>
                  {DATUM.format(t.start)} Uhr
                  {!erfassbar && <span className="ml-2 text-gray-400">· noch nicht begonnen</span>}
                </div>
              </div>

              <div className="mt-1 text-xs text-gray-500">
                {liste.length} von {t.kapazitaet} Plätzen belegt
              </div>

              <ul className="mt-3 divide-y divide-gray-100">
                {liste.map((tn) => (
                  <li key={tn.mitgliedId} className="py-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm">{tn.name}</span>
                      <AnwesenheitAktion
                        kursterminId={t.kursterminId}
                        mitgliedId={tn.mitgliedId}
                        aktuell={tn.anwesenheit as AnwesenheitWert}
                        erfassbar={erfassbar}
                      />
                    </div>
                    <TrainerNotiz
                      kursterminId={t.kursterminId}
                      mitgliedId={tn.mitgliedId}
                      notiz={tn.notiz}
                    />
                  </li>
                ))}
                {liste.length === 0 && (
                  <li className="py-2 text-sm text-gray-500">Keine Teilnehmer.</li>
                )}
              </ul>
            </li>
          );
        })}
        {termine.length === 0 && (
          <li className="text-sm text-gray-500">Keine eigenen Kurstermine.</li>
        )}
      </ul>
    </main>
  );
}
