import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buchung, kurstermin } from "@/lib/db/schema";

// FZ-012 — Trainer-Notizen zu Teilnehmern (spec §7 Should-have). §2b: Trainer darf auf
// Buchungen eigener Kurse nur `anwesenheit` + `trainer_notiz` ändern. Freitext je
// Teilnehmer/Termin (z. B. „wirkte verletzt"). Leere Notiz = löschen (null).
//
// Anders als die Anwesenheit (FZ-004) ist die Notiz keine Nach-Kurs-Aktion und hat
// daher keine Zeitgrenze — sie darf jederzeit gesetzt/geändert werden.

export type NotizErgebnis =
  | { status: "gespeichert"; notiz: string | null }
  | { status: "kurs_nicht_gefunden" }
  | { status: "nicht_dein_kurs" } // Trainer besitzt diesen Kurstermin nicht (§2b)
  | { status: "keine_buchung" }; // kein/e aktive/r Teilnehmer/in für diesen Termin

/**
 * Setzt (oder löscht) die Trainer-Notiz zu einem Teilnehmer eines Kurstermins. Der
 * Trainer darf nur eigene Termine bearbeiten (§2b) und nur aktive (bestätigte)
 * Buchungen. Ein leerer/whitespace-Text löscht die Notiz (null).
 */
export async function setzeTrainerNotiz(
  trainerId: string,
  kursterminId: string,
  mitgliedId: string,
  notiz: string,
): Promise<NotizErgebnis> {
  const [termin] = await db
    .select({ trainerId: kurstermin.trainerId })
    .from(kurstermin)
    .where(eq(kurstermin.kursterminId, kursterminId));
  if (!termin) return { status: "kurs_nicht_gefunden" };

  // Sichtbarkeit/Rechte: Trainer nur eigene Kurse (§2b).
  if (termin.trainerId !== trainerId) return { status: "nicht_dein_kurs" };

  // Nur aktive (bestätigte) Buchungen bekommen eine Notiz; Stornos zählen nicht.
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

  const wert = notiz.trim() === "" ? null : notiz.trim();
  await db.update(buchung).set({ trainerNotiz: wert }).where(eq(buchung.buchungId, b.id));

  return { status: "gespeichert", notiz: wert };
}
