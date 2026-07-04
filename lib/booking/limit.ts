import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { buchung, kurstermin, mitglied, tarif } from "@/lib/db/schema";

// FZ-010 — Buchungslimit pro Tarif (BR4). Basic = 5 aktive Buchungen pro Kalendermonat
// (nach Kurstermin-Datum); Plus/Premium = kein Zähllimit (tarif.buchungslimit_pro_monat = null).
// Konzept: docs/concepts/FZ-010-buchungslimit.md

// Transaktions-Typ aus db.transaction ableiten (wie in warteliste.ts).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type LimitStatus =
  | { erlaubt: true }
  | { erlaubt: false; limit: number; anzahl: number };

// Kalendermonat, in dem der Kurs stattfindet: [Monatserster, nächster Monatserster).
export function monatsfenster(kurszeit: Date): { von: Date; bis: Date } {
  const von = new Date(kurszeit.getFullYear(), kurszeit.getMonth(), 1);
  const bis = new Date(kurszeit.getFullYear(), kurszeit.getMonth() + 1, 1);
  return { von, bis };
}

/**
 * Prüft (innerhalb der Buchungs-Transaktion), ob das Mitglied für einen Kurstermin im
 * Monat `start` noch eine Buchung anlegen darf. Zählt nur **aktive** (bestätigte)
 * Buchungen im selben Kalendermonat — Storno gibt einen Platz frei (Missbrauch fängt das
 * No-Show-Tracking, BR6). Tarife ohne Limit (null) sind immer erlaubt.
 */
export async function pruefeMonatslimit(
  tx: Tx,
  mitgliedId: string,
  start: Date,
): Promise<LimitStatus> {
  const [t] = await tx
    .select({ limit: tarif.buchungslimitProMonat })
    .from(mitglied)
    .innerJoin(tarif, eq(mitglied.tarifId, tarif.tarifId))
    .where(eq(mitglied.mitgliedId, mitgliedId));

  const limit = t?.limit ?? null;
  if (limit == null) return { erlaubt: true };

  const { von, bis } = monatsfenster(start);
  const [{ anzahl }] = await tx
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(buchung)
    .innerJoin(kurstermin, eq(buchung.kursterminId, kurstermin.kursterminId))
    .where(
      and(
        eq(buchung.mitgliedId, mitgliedId),
        eq(buchung.buchungsstatus, "bestaetigt"),
        gte(kurstermin.start, von),
        lt(kurstermin.start, bis),
      ),
    );

  return anzahl >= limit ? { erlaubt: false, limit, anzahl } : { erlaubt: true };
}
