import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { buchung, kurstermin, mitglied, tarif } from "@/lib/db/schema";

// FZ-013 — No-Show-Auswertung mit Admin-Hinweis ab Schwelle (BR6). Zählt je Mitglied die
// als `no_show` erfassten Buchungen (FZ-004) in einem gleitenden Fenster und markiert
// Mitglieder ab der Schwelle. **Keine Auto-Sperre** (BR6/W1) — auch Premium bleibt
// buchbar; die Konsequenz entscheidet der Admin manuell.

// Schwelle und Fenster sind laut spec §8 offen (Lisa nannte „3–4 Mal"). Konservativer
// Default am unteren Rand (frühere Sichtbarkeit); zentral, mit Kundin zu bestätigen.
export const NO_SHOW_SCHWELLE = 3;
export const NO_SHOW_FENSTER_TAGE = 90;

export type NoShowEintrag = {
  mitgliedId: string;
  mitgliedName: string;
  tarif: string;
  anzahl: number;
  hinweis: boolean; // anzahl >= schwelle → Admin-Hinweis
};

/**
 * No-Shows je Mitglied im Fenster (nach Kurs-Datum `kurstermin.start`), absteigend
 * sortiert. `hinweis=true` ab der Schwelle. Optionaler `mitgliedIds`-Filter (Test /
 * künftige Detailsicht). Reine Lese-Aggregation — kein Schema-/Statuswechsel.
 */
export async function ladeNoShowAuswertung(opts: {
  schwelle?: number;
  fensterTage?: number;
  mitgliedIds?: string[];
} = {}): Promise<NoShowEintrag[]> {
  const schwelle = opts.schwelle ?? NO_SHOW_SCHWELLE;
  const fensterTage = opts.fensterTage ?? NO_SHOW_FENSTER_TAGE;
  const grenze = new Date(Date.now() - fensterTage * 86_400_000);

  const bedingungen = [eq(buchung.anwesenheit, "no_show"), gte(kurstermin.start, grenze)];
  if (opts.mitgliedIds) bedingungen.push(inArray(buchung.mitgliedId, opts.mitgliedIds));

  const rows = await db
    .select({
      mitgliedId: mitglied.mitgliedId,
      mitgliedName: mitglied.name,
      tarif: tarif.name,
      anzahl: sql<number>`count(*)::int`,
    })
    .from(buchung)
    .innerJoin(kurstermin, eq(buchung.kursterminId, kurstermin.kursterminId))
    .innerJoin(mitglied, eq(buchung.mitgliedId, mitglied.mitgliedId))
    .innerJoin(tarif, eq(mitglied.tarifId, tarif.tarifId))
    .where(and(...bedingungen))
    .groupBy(mitglied.mitgliedId, mitglied.name, tarif.name);

  return rows
    .map((r) => ({ ...r, hinweis: r.anzahl >= schwelle }))
    .sort((a, b) => b.anzahl - a.anzahl || a.mitgliedName.localeCompare(b.mitgliedName));
}
