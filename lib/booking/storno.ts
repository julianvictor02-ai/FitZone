import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buchung, kurstermin, kurstyp, mitglied, tarif } from "@/lib/db/schema";
import { verarbeiteWarteliste } from "@/lib/booking/warteliste";

// FZ-003 — Selbst-Stornierung mit Fristen/Gebühren-Flag (BR5).
// Konzept: docs/concepts/FZ-003-storno.md

// Storno-/Buchungsfrist vor Kursstart. Lisas Richtwert (spec §4 BR5), global,
// noch offiziell zu fixieren (spec §8). Zentrale Konstante.
export const STORNO_FRIST_STUNDEN = 2;
const FRIST_MS = STORNO_FRIST_STUNDEN * 3_600_000;

// Wird bei Storno eine Gebühr fällig? Nicht-befreite Tarife, die innerhalb der
// Frist (weniger als STORNO_FRIST_STUNDEN vor Start) stornieren. Premium ist befreit.
export function stornoGebuehrFaellig(
  start: Date,
  befreit: boolean,
  jetzt: Date = new Date(),
): boolean {
  if (befreit) return false;
  return jetzt.getTime() > start.getTime() - FRIST_MS;
}

// Stornogebühr = 50 % des Einzelkurs-Preises (FZ-016, Kundenentscheidung 2026-07-04).
export const STORNO_GEBUEHR_ANTEIL = 0.5;

// Konkreter Gebührenbetrag: nur wenn die Gebühr fällig ist UND der Kurspreis gepflegt
// ist (sonst null → v1-Verhalten: Flag ohne Betrag, manuelle Abwicklung).
export function berechneStornoGebuehr(
  einzelpreis: number | null,
  faellig: boolean,
): number | null {
  if (!faellig || einzelpreis == null) return null;
  return Math.round(einzelpreis * STORNO_GEBUEHR_ANTEIL * 100) / 100;
}

export type StornoErgebnis =
  | { status: "storniert"; gebuehrFaellig: boolean; betrag: number | null }
  | { status: "keine_buchung" }
  | { status: "kurs_nicht_gefunden" };

/**
 * Storniert die aktive Buchung eines Mitglieds: setzt `stornozeitpunkt` und markiert
 * die Gebührenpflicht (Flag, keine Auto-Abbuchung in v1). Wird dadurch ein Platz in
 * einem künftigen, geplanten Termin frei, rückt anschließend die Warteliste nach
 * (FZ-002-Engine).
 */
export async function storniereBuchung(
  mitgliedId: string,
  kursterminId: string,
): Promise<StornoErgebnis> {
  const { ergebnis, nachruecken } = await db.transaction(async (tx) => {
    const [termin] = await tx
      .select({
        start: kurstermin.start,
        status: kurstermin.status,
        kurstypId: kurstermin.kurstypId,
      })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, kursterminId))
      .for("update");
    if (!termin) {
      return { ergebnis: { status: "kurs_nicht_gefunden" as const }, nachruecken: false };
    }

    const [b] = await tx
      .select({ id: buchung.buchungId })
      .from(buchung)
      .where(
        and(
          eq(buchung.mitgliedId, mitgliedId),
          eq(buchung.kursterminId, kursterminId),
          eq(buchung.buchungsstatus, "bestaetigt"),
        ),
      );
    if (!b) {
      return { ergebnis: { status: "keine_buchung" as const }, nachruecken: false };
    }

    const [tarifInfo] = await tx
      .select({ befreit: tarif.stornoGebuehrBefreit })
      .from(mitglied)
      .innerJoin(tarif, eq(mitglied.tarifId, tarif.tarifId))
      .where(eq(mitglied.mitgliedId, mitgliedId));

    const jetzt = new Date();
    const gebuehrFaellig = stornoGebuehrFaellig(termin.start, tarifInfo?.befreit ?? false, jetzt);

    // Einzelkurs-Preis der Kursart (ungelockt) → konkreter Gebührenbetrag (FZ-016).
    const [kt] = await tx
      .select({ einzelpreis: kurstyp.einzelpreis })
      .from(kurstyp)
      .where(eq(kurstyp.kurstypId, termin.kurstypId));
    const einzelpreis = kt?.einzelpreis != null ? Number(kt.einzelpreis) : null;
    const betrag = berechneStornoGebuehr(einzelpreis, gebuehrFaellig);

    await tx
      .update(buchung)
      .set({
        buchungsstatus: "storniert",
        stornozeitpunkt: jetzt,
        stornoGebuehrFaellig: gebuehrFaellig,
        stornoGebuehrBetrag: betrag != null ? betrag.toFixed(2) : null,
      })
      .where(eq(buchung.buchungId, b.id));

    return {
      ergebnis: { status: "storniert" as const, gebuehrFaellig, betrag },
      nachruecken: termin.status === "geplant" && termin.start > jetzt,
    };
  });

  if (nachruecken) await verarbeiteWarteliste(kursterminId);
  return ergebnis;
}
