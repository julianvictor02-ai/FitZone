import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buchung, kurstermin } from "@/lib/db/schema";

// FZ-004 — Anwesenheitserfassung mit Zeitstempel.
// Konzept: docs/concepts/FZ-004-anwesenheit.md
// Spec: §2 (Buchung-Workflow "nach Kursende offen → anwesend|no_show|entschuldigt"),
// §2b (Trainer: U nur auf anwesenheit eigener Kurse), §7. Basis für No-Show (BR6).

// Zulässige Anwesenheits-Werte (Enum buchung.anwesenheit). "offen" = zurücksetzen
// auf nicht-erfasst (Korrektur durch Trainer).
export type AnwesenheitWert = "offen" | "anwesend" | "no_show" | "entschuldigt";

export type AnwesenheitErgebnis =
  | { status: "erfasst"; wert: AnwesenheitWert; erfasstAm: Date | null }
  | { status: "kurs_nicht_gefunden" }
  | { status: "nicht_dein_kurs" } //   Trainer besitzt diesen Kurstermin nicht (§2b)
  | { status: "keine_buchung" } //     kein/e aktive/r Teilnehmer/in für diesen Termin
  | { status: "zu_frueh" }; //         Kurs hat noch nicht begonnen

/**
 * Erfasst die Anwesenheit eines Teilnehmers für einen Kurstermin (FZ-004). Der Trainer
 * darf nur eigene Termine abhaken (§2b) und erst, nachdem der Kurs begonnen hat. Setzt
 * `anwesenheit` und den Erfassungs-Zeitstempel `anwesenheit_erfasst_am` (auditierbar,
 * NFR). Bei `wert="offen"` (Korrektur) wird der Zeitstempel geleert.
 *
 * Der Nachweis-Zeitstempel `buchungszeitpunkt` bleibt unberührt (NFR, "nicht verhandelbar").
 */
export async function erfasseAnwesenheit(
  trainerId: string,
  kursterminId: string,
  mitgliedId: string,
  wert: AnwesenheitWert,
): Promise<AnwesenheitErgebnis> {
  const [termin] = await db
    .select({ trainerId: kurstermin.trainerId, start: kurstermin.start })
    .from(kurstermin)
    .where(eq(kurstermin.kursterminId, kursterminId));
  if (!termin) return { status: "kurs_nicht_gefunden" };

  // Sichtbarkeit/Rechte: Trainer nur eigene Kurse (§2b).
  if (termin.trainerId !== trainerId) return { status: "nicht_dein_kurs" };

  // Anwesenheit ist eine Nach-Kurs-Aktion (§2): vor Kursbeginn nicht erfassbar. Es ist
  // nur `start` modelliert (kein Kursende) → Grenze = Kursbeginn.
  if (termin.start > new Date()) return { status: "zu_frueh" };

  // Nur aktive (bestätigte) Buchungen haben eine Anwesenheit; Stornos zählen nicht.
  const [b] = await db
    .select({ id: buchung.buchungId })
    .from(buchung)
    .where(
      and(
        eq(buchung.mitgliedId, mitgliedId),
        eq(buchung.kursterminId, kursterminId),
        eq(buchung.buchungsstatus, "bestaetigt"),
      ),
    );
  if (!b) return { status: "keine_buchung" };

  const erfasstAm = wert === "offen" ? null : new Date();
  await db
    .update(buchung)
    .set({ anwesenheit: wert, anwesenheitErfasstAm: erfasstAm })
    .where(eq(buchung.buchungId, b.id));

  return { status: "erfasst", wert, erfasstAm };
}
