import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { buchung, kurstermin, kurstyp, mitglied, wartelisteneintrag } from "@/lib/db/schema";

// FZ-008 — Buchungsnachweis/Zeitstempel für alle Vorgänge (spec §6 NFR, §7).
// Konsolidiert die bereits vorhandenen, unveränderbaren Zeitstempel aller Vorgänge
// (Buchung, Storno, Anwesenheit, Warteliste, Nachrücken) zu einem chronologischen,
// nachweisbaren Audit-Log. Reine Lese-Aggregation — kein Schema-/Engine-Change.

export type NachweisVorgang =
  | "gebucht"
  | "storniert"
  | "anwesenheit_erfasst"
  | "warteliste_beigetreten"
  | "nachrueck_angebot";

export type NachweisEreignis = {
  zeitpunkt: Date;
  vorgang: NachweisVorgang;
  mitgliedId: string;
  mitgliedName: string;
  kursterminId: string;
  kurstyp: string;
  kursStart: Date;
  detail?: string;
};

const ANWESENHEIT_DETAIL: Record<string, string> = {
  anwesend: "anwesend",
  no_show: "No-Show",
  entschuldigt: "entschuldigt",
};

/**
 * Liefert die jüngsten `limit` Nachweis-Ereignisse (neueste zuerst), optional auf
 * bestimmte Mitglieder eingeschränkt. Jedes Ereignis trägt den unveränderbaren
 * Zeitstempel des jeweiligen Vorgangs — der Buchungsnachweis (§6, „nicht verhandelbar").
 */
export async function ladeNachweisEreignisse(opts: {
  limit?: number;
  mitgliedIds?: string[];
} = {}): Promise<NachweisEreignis[]> {
  const limit = opts.limit ?? 200;
  const mFilter = opts.mitgliedIds;

  const buchungen = await db
    .select({
      mitgliedId: buchung.mitgliedId,
      mitgliedName: mitglied.name,
      kursterminId: buchung.kursterminId,
      kurstyp: kurstyp.name,
      kursStart: kurstermin.start,
      buchungszeitpunkt: buchung.buchungszeitpunkt,
      stornozeitpunkt: buchung.stornozeitpunkt,
      gebuehr: buchung.stornoGebuehrFaellig,
      anwesenheit: buchung.anwesenheit,
      anwesenheitErfasstAm: buchung.anwesenheitErfasstAm,
    })
    .from(buchung)
    .innerJoin(mitglied, eq(buchung.mitgliedId, mitglied.mitgliedId))
    .innerJoin(kurstermin, eq(buchung.kursterminId, kurstermin.kursterminId))
    .innerJoin(kurstyp, eq(kurstermin.kurstypId, kurstyp.kurstypId))
    .where(mFilter ? inArray(buchung.mitgliedId, mFilter) : undefined);

  const warteliste = await db
    .select({
      mitgliedId: wartelisteneintrag.mitgliedId,
      mitgliedName: mitglied.name,
      kursterminId: wartelisteneintrag.kursterminId,
      kurstyp: kurstyp.name,
      kursStart: kurstermin.start,
      zeitstempel: wartelisteneintrag.zeitstempel,
      benachrichtigtAm: wartelisteneintrag.benachrichtigtAm,
    })
    .from(wartelisteneintrag)
    .innerJoin(mitglied, eq(wartelisteneintrag.mitgliedId, mitglied.mitgliedId))
    .innerJoin(kurstermin, eq(wartelisteneintrag.kursterminId, kurstermin.kursterminId))
    .innerJoin(kurstyp, eq(kurstermin.kurstypId, kurstyp.kurstypId))
    .where(mFilter ? inArray(wartelisteneintrag.mitgliedId, mFilter) : undefined);

  const ereignisse: NachweisEreignis[] = [];
  const basis = (r: {
    mitgliedId: string;
    mitgliedName: string;
    kursterminId: string;
    kurstyp: string;
    kursStart: Date;
  }) => ({
    mitgliedId: r.mitgliedId,
    mitgliedName: r.mitgliedName,
    kursterminId: r.kursterminId,
    kurstyp: r.kurstyp,
    kursStart: r.kursStart,
  });

  for (const b of buchungen) {
    ereignisse.push({ ...basis(b), zeitpunkt: b.buchungszeitpunkt, vorgang: "gebucht" });
    if (b.stornozeitpunkt) {
      ereignisse.push({
        ...basis(b),
        zeitpunkt: b.stornozeitpunkt,
        vorgang: "storniert",
        detail: b.gebuehr ? "Stornogebühr fällig" : undefined,
      });
    }
    if (b.anwesenheitErfasstAm) {
      ereignisse.push({
        ...basis(b),
        zeitpunkt: b.anwesenheitErfasstAm,
        vorgang: "anwesenheit_erfasst",
        detail: ANWESENHEIT_DETAIL[b.anwesenheit] ?? b.anwesenheit,
      });
    }
  }

  for (const w of warteliste) {
    ereignisse.push({ ...basis(w), zeitpunkt: w.zeitstempel, vorgang: "warteliste_beigetreten" });
    if (w.benachrichtigtAm) {
      ereignisse.push({ ...basis(w), zeitpunkt: w.benachrichtigtAm, vorgang: "nachrueck_angebot" });
    }
  }

  ereignisse.sort((a, b) => b.zeitpunkt.getTime() - a.zeitpunkt.getTime());
  return ereignisse.slice(0, limit);
}
