import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, kurstyp, trainer, mitglied, kurstermin, buchung, wartelisteneintrag } from "../lib/db/schema";
import { bucheKurstermin } from "../lib/booking/buchung";
import { storniereBuchung } from "../lib/booking/storno";
import { warteAufKurstermin, bestaetigeNachrueckung } from "../lib/booking/warteliste";

// Verifiziert FZ-010 (BR4) gegen die echte DB: Basic = 5 Buchungen/Kalendermonat (hart),
// Storno gibt einen Platz frei, Monatsgrenze, Plus/Premium unbegrenzt — auch beim
// Nachrücken. Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

async function main() {
  const s = Date.now();
  const [tBasic] = await db.select().from(tarif).where(eq(tarif.name, "Basic"));
  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));
  const [tPrem] = await db.select().from(tarif).where(eq(tarif.name, "Premium"));
  const [kYoga] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));
  const [tr] = await db.insert(trainer).values({ name: `T ${s}`, email: `t-${s}@verify.test` }).returning();

  const mIds: string[] = [];
  const ktIds: string[] = [];
  async function member(tag: string, tarifId: string): Promise<string> {
    const [m] = await db.insert(mitglied).values({ name: tag, email: `${tag}-${s}@verify.test`, tarifId }).returning();
    mIds.push(m.mitgliedId);
    return m.mitgliedId;
  }
  async function termin(start: Date, kap = 10): Promise<string> {
    const [kt] = await db
      .insert(kurstermin)
      .values({ kurstypId: kYoga.kurstypId, trainerId: tr.trainerId, modus: "Studio", start, kapazitaet: kap, status: "geplant" })
      .returning();
    ktIds.push(kt.kursterminId);
    return kt.kursterminId;
  }
  const now = new Date();
  // Zwei klar getrennte, künftige Kalendermonate (Tag 15, verschiedene Stunden).
  const monatA = (h: number) => new Date(now.getFullYear(), now.getMonth() + 2, 15, h, 0, 0);
  const monatB = (h: number) => new Date(now.getFullYear(), now.getMonth() + 3, 15, h, 0, 0);

  try {
    // --- Basic: 5/Monat hart ---
    console.log("Basic — Direktbuchung (5/Kalendermonat):");
    const mBasic = await member("basic", tBasic.tarifId);
    const tA: string[] = [];
    for (let i = 0; i < 6; i++) tA.push(await termin(monatA(6 + i)));

    let okCount = 0;
    for (let i = 0; i < 5; i++) {
      const r = await bucheKurstermin(mBasic, tA[i]);
      if (r.status === "bestaetigt") okCount++;
    }
    pruefe("erste 5 Buchungen im Monat bestätigt", okCount === 5, `ok=${okCount}`);

    const r6 = await bucheKurstermin(mBasic, tA[5]);
    pruefe("6. Buchung im selben Monat abgelehnt (limit_erreicht)", r6.status === "limit_erreicht", r6.status);
    pruefe("limit-Wert = 5", r6.status === "limit_erreicht" && r6.limit === 5, JSON.stringify(r6));

    // --- Storno gibt Platz frei ---
    console.log("Storno gibt Slot frei:");
    await storniereBuchung(mBasic, tA[0]); // → 4 aktive im Monat
    const rNach = await bucheKurstermin(mBasic, tA[5]);
    pruefe("nach Storno wieder buchbar (4 → 5)", rNach.status === "bestaetigt", rNach.status);
    // mBasic hat jetzt 5 aktive in Monat A (tA[1..5]).

    // --- Anderer Kalendermonat zählt separat ---
    console.log("Monatsgrenze:");
    const tB = await termin(monatB(6));
    const rB = await bucheKurstermin(mBasic, tB);
    pruefe("Buchung im Folgemonat trotz Limit im Vormonat erlaubt", rB.status === "bestaetigt", rB.status);

    // --- Plus / Premium: kein Zähllimit ---
    console.log("Plus / Premium — unbegrenzt:");
    const mPlus = await member("plus", tPlus.tarifId);
    let plusOk = 0;
    for (let i = 0; i < 6; i++) if ((await bucheKurstermin(mPlus, tA[i])).status === "bestaetigt") plusOk++;
    pruefe("Plus bucht 6 im Monat — alle bestätigt", plusOk === 6, `ok=${plusOk}`);

    const mPrem = await member("prem", tPrem.tarifId);
    let premOk = 0;
    for (let i = 0; i < 6; i++) if ((await bucheKurstermin(mPrem, tA[i])).status === "bestaetigt") premOk++;
    pruefe("Premium bucht 6 im Monat — alle bestätigt", premOk === 6, `ok=${premOk}`);

    // --- Nachrücken respektiert das Limit (Basic) ---
    console.log("Nachrücken — Limit gilt auch hier:");
    const mB2 = await member("basic2", tBasic.tarifId);
    for (let i = 0; i < 5; i++) await bucheKurstermin(mB2, await termin(monatA(12 + i))); // 5 in Monat A
    const tFull = await termin(monatA(20), 1);
    const filler = await member("fill", tPlus.tarifId);
    await bucheKurstermin(filler, tFull); // voll
    await warteAufKurstermin(mB2, tFull); // wartend
    await storniereBuchung(filler, tFull); // frei → mB2 wird benachrichtigt (verarbeiteWarteliste)
    const rNr = await bestaetigeNachrueckung(mB2, tFull);
    pruefe("Basic am Limit → Nachrücken abgelehnt (limit_erreicht)", rNr.status === "limit_erreicht", rNr.status);

    // --- Nachrücken ohne Limit (Plus) ---
    const mP2 = await member("plus2", tPlus.tarifId);
    const tFull2 = await termin(monatA(21), 1);
    const filler2 = await member("fill2", tPrem.tarifId);
    await bucheKurstermin(filler2, tFull2); // voll
    await warteAufKurstermin(mP2, tFull2);
    await storniereBuchung(filler2, tFull2); // → mP2 benachrichtigt
    const rNr2 = await bestaetigeNachrueckung(mP2, tFull2);
    pruefe("Plus → Nachrücken erlaubt (nachgerueckt)", rNr2.status === "nachgerueckt", rNr2.status);
  } finally {
    await db.delete(wartelisteneintrag).where(inArray(wartelisteneintrag.kursterminId, ktIds));
    await db.delete(buchung).where(inArray(buchung.kursterminId, ktIds));
    await db.delete(kurstermin).where(inArray(kurstermin.kursterminId, ktIds));
    await db.delete(mitglied).where(inArray(mitglied.mitgliedId, mIds));
    await db.delete(trainer).where(eq(trainer.trainerId, tr.trainerId));
  }

  console.log(`\nErgebnis: ${fehler === 0 ? "ALLE OK" : `${fehler} fehlgeschlagen`}`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
