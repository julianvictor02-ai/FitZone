import { and, eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, kurstyp, trainer, mitglied, kurstermin, buchung, wartelisteneintrag } from "../lib/db/schema";
import { bucheKurstermin } from "../lib/booking/buchung";
import { warteAufKurstermin } from "../lib/booking/warteliste";
import { storniereBuchung } from "../lib/booking/storno";

// Verifiziert FZ-003 (BR5) gegen die echte DB: Gebühren-Flag nach Frist/Tarif und
// Storno → Nachrücken (FZ-002-Integration). Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

async function main() {
  const s = Date.now();
  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));
  const [tPrem] = await db.select().from(tarif).where(eq(tarif.name, "Premium"));
  const [tr] = await db
    .insert(trainer)
    .values({ name: `St ${s}`, email: `st-tr-${s}@verify.test` })
    .returning();
  const [kYoga] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));

  const mIds: string[] = [];
  const ktIds: string[] = [];
  async function member(tag: string, tarifId: string): Promise<string> {
    const [m] = await db
      .insert(mitglied)
      .values({ name: tag, email: `${tag}-${s}@verify.test`, tarifId })
      .returning();
    mIds.push(m.mitgliedId);
    return m.mitgliedId;
  }
  async function termin(kap: number, start: Date): Promise<string> {
    const [kt] = await db
      .insert(kurstermin)
      .values({ kurstypId: kYoga.kurstypId, trainerId: tr.trainerId, modus: "Studio", start, kapazitaet: kap, status: "geplant" })
      .returning();
    ktIds.push(kt.kursterminId);
    return kt.kursterminId;
  }
  const inStunden = (h: number) => new Date(Date.now() + h * 3_600_000);

  try {
    // --- Gebühren-Logik (BR5) ---
    console.log("Gebühren-Flag (Frist = 2 h, Premium befreit):");

    const mSpaet = await member("plus-spaet", tPlus.tarifId);
    const ktSpaet = await termin(5, inStunden(1)); // < 2 h → innerhalb Frist
    await bucheKurstermin(mSpaet, ktSpaet);
    const rSpaet = await storniereBuchung(mSpaet, ktSpaet);
    pruefe(
      "Plus storniert innerhalb Frist → Gebühr fällig",
      rSpaet.status === "storniert" && rSpaet.gebuehrFaellig === true,
      JSON.stringify(rSpaet),
    );

    const mFrueh = await member("plus-frueh", tPlus.tarifId);
    const ktFrueh = await termin(5, inStunden(48)); // > 2 h → rechtzeitig
    await bucheKurstermin(mFrueh, ktFrueh);
    const rFrueh = await storniereBuchung(mFrueh, ktFrueh);
    pruefe(
      "Plus storniert rechtzeitig → keine Gebühr",
      rFrueh.status === "storniert" && rFrueh.gebuehrFaellig === false,
      JSON.stringify(rFrueh),
    );

    const mPrem = await member("prem-spaet", tPrem.tarifId);
    const ktPrem = await termin(5, inStunden(1)); // innerhalb Frist, aber Premium
    await bucheKurstermin(mPrem, ktPrem);
    const rPrem = await storniereBuchung(mPrem, ktPrem);
    pruefe(
      "Premium innerhalb Frist → befreit (keine Gebühr)",
      rPrem.status === "storniert" && rPrem.gebuehrFaellig === false,
      JSON.stringify(rPrem),
    );

    // --- Storno → Nachrücken (FZ-002-Integration) ---
    console.log("Storno löst Nachrücken aus:");
    const A = await member("A", tPlus.tarifId);
    const B = await member("B", tPlus.tarifId);
    const kt = await termin(1, inStunden(48));
    await bucheKurstermin(A, kt); // voll
    await warteAufKurstermin(B, kt); // wartend

    const rA = await storniereBuchung(A, kt);
    pruefe("A storniert (rechtzeitig, keine Gebühr)", rA.status === "storniert" && rA.gebuehrFaellig === false);

    const [bWl] = await db
      .select({ status: wartelisteneintrag.status })
      .from(wartelisteneintrag)
      .where(and(eq(wartelisteneintrag.mitgliedId, B), eq(wartelisteneintrag.kursterminId, kt)));
    pruefe("frei gewordener Platz → B rückt automatisch nach", bWl?.status === "benachrichtigt", `status=${bWl?.status}`);

    // --- Doppel-Storno ---
    const rA2 = await storniereBuchung(A, kt);
    pruefe("erneutes Storno ohne aktive Buchung → keine_buchung", rA2.status === "keine_buchung", rA2.status);
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
