import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, kurstyp, trainer, mitglied, kurstermin, buchung, wartelisteneintrag } from "../lib/db/schema";
import { bucheKurstermin } from "../lib/booking/buchung";
import { warteAufKurstermin } from "../lib/booking/warteliste";
import { darfLivestreamBuchen } from "../lib/content/zugriff";

// Verifiziert FZ-018 (BR7 / Kundenentscheidung §8 Frage 4): Basic darf keine Livestreams
// buchen (nur Studio); Plus/Premium dürfen. Server-seitiges Gate in Buchung + Warteliste.
// Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

async function main() {
  const s = Date.now();
  const [tBasic] = await db.select().from(tarif).where(eq(tarif.name, "Basic"));
  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));
  const [kYoga] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));
  const [tr] = await db.insert(trainer).values({ name: `Ls ${s}`, email: `ls-tr-${s}@verify.test` }).returning();

  const mIds: string[] = [];
  const ktIds: string[] = [];
  async function member(tag: string, tarifId: string): Promise<string> {
    const [m] = await db.insert(mitglied).values({ name: tag, email: `${tag}-${s}@verify.test`, tarifId }).returning();
    mIds.push(m.mitgliedId);
    return m.mitgliedId;
  }
  async function termin(modus: "Studio" | "Livestream", kap: number): Promise<string> {
    const [kt] = await db
      .insert(kurstermin)
      .values({ kurstypId: kYoga.kurstypId, trainerId: tr.trainerId, modus, start: new Date(Date.now() + 48 * 3_600_000), kapazitaet: kap, status: "geplant" })
      .returning();
    ktIds.push(kt.kursterminId);
    return kt.kursterminId;
  }

  try {
    console.log("Reine Zugriffsregel:");
    pruefe("darfLivestreamBuchen(true) = true", darfLivestreamBuchen(true) === true);
    pruefe("darfLivestreamBuchen(false) = false", darfLivestreamBuchen(false) === false);
    pruefe("darfLivestreamBuchen(null) = false", darfLivestreamBuchen(null) === false);

    const basic = await member("basic", tBasic.tarifId);
    const plus = await member("plus", tPlus.tarifId);

    console.log("Basic (nur Studio):");
    const ktLive = await termin("Livestream", 5);
    const rBuche = await bucheKurstermin(basic, ktLive);
    pruefe("Basic bucht Livestream → livestream_gesperrt", rBuche.status === "livestream_gesperrt", rBuche.status);

    const rWarte = await warteAufKurstermin(basic, ktLive);
    pruefe("Basic Warteliste Livestream → livestream_gesperrt", rWarte.status === "livestream_gesperrt", rWarte.status);

    const ktStudio = await termin("Studio", 5);
    const rStudio = await bucheKurstermin(basic, ktStudio);
    pruefe("Basic bucht Studio → bestaetigt", rStudio.status === "bestaetigt", rStudio.status);

    console.log("Plus (Livestream erlaubt):");
    const rPlus = await bucheKurstermin(plus, ktLive);
    pruefe("Plus bucht Livestream → bestaetigt", rPlus.status === "bestaetigt", rPlus.status);
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
