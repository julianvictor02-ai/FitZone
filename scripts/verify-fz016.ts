import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, kurstyp, trainer, mitglied, kurstermin, buchung, wartelisteneintrag } from "../lib/db/schema";
import { bucheKurstermin } from "../lib/booking/buchung";
import { storniereBuchung, berechneStornoGebuehr } from "../lib/booking/storno";

// Verifiziert FZ-016 (BR5, Kundenentscheidung §8 F7): Stornogebühr = 50 % des
// Einzelkurs-Preises (kurstyp.einzelpreis); Premium befreit; rechtzeitig keine Gebühr;
// ohne Preis nur Flag ohne Betrag. Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

async function main() {
  const s = Date.now();
  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));
  const [tPrem] = await db.select().from(tarif).where(eq(tarif.name, "Premium"));
  const [tr] = await db.insert(trainer).values({ name: `Ge ${s}`, email: `ge-tr-${s}@verify.test` }).returning();

  // Eigene Kurstypen mit/ohne Preis (Namen sind Enum → nur die 5 erlaubten; wir nutzen
  // bestehende Typen und setzen den Preis temporär, mit Wiederherstellung).
  const [kMitPreis] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));
  const [kOhnePreis] = await db.select().from(kurstyp).where(eq(kurstyp.name, "HIIT"));
  const preisVorherYoga = kMitPreis.einzelpreis;
  const preisVorherHiit = kOhnePreis.einzelpreis;

  const mIds: string[] = [];
  const ktIds: string[] = [];
  async function member(tag: string, tarifId: string): Promise<string> {
    const [m] = await db.insert(mitglied).values({ name: tag, email: `${tag}-${s}@verify.test`, tarifId }).returning();
    mIds.push(m.mitgliedId);
    return m.mitgliedId;
  }
  async function termin(kurstypId: string, startVorInStunden: number): Promise<string> {
    const [kt] = await db
      .insert(kurstermin)
      .values({ kurstypId, trainerId: tr.trainerId, modus: "Studio", start: new Date(Date.now() + startVorInStunden * 3_600_000), kapazitaet: 5, status: "geplant" })
      .returning();
    ktIds.push(kt.kursterminId);
    return kt.kursterminId;
  }

  try {
    console.log("Reine Berechnung:");
    pruefe("50 % von 20 = 10", berechneStornoGebuehr(20, true) === 10);
    pruefe("nicht fällig → null", berechneStornoGebuehr(20, false) === null);
    pruefe("kein Preis → null", berechneStornoGebuehr(null, true) === null);
    pruefe("ungerade Rundung (50 % von 15 = 7,5)", berechneStornoGebuehr(15, true) === 7.5);

    // Yoga = 20 €, HIIT = ohne Preis.
    await db.update(kurstyp).set({ einzelpreis: "20.00" }).where(eq(kurstyp.kurstypId, kMitPreis.kurstypId));
    await db.update(kurstyp).set({ einzelpreis: null }).where(eq(kurstyp.kurstypId, kOhnePreis.kurstypId));

    console.log("Storno mit Preis (Yoga 20 €):");
    // Plus, innerhalb Frist (<2 h) → Gebühr fällig, Betrag 10.
    const A = await member("A", tPlus.tarifId);
    const ktSpaet = await termin(kMitPreis.kurstypId, 1);
    await bucheKurstermin(A, ktSpaet);
    const rA = await storniereBuchung(A, ktSpaet);
    pruefe("Plus innerhalb Frist → Gebühr 10 €", rA.status === "storniert" && rA.gebuehrFaellig === true && rA.betrag === 10, JSON.stringify(rA));
    const [bA] = await db.select({ betrag: buchung.stornoGebuehrBetrag }).from(buchung).where(eq(buchung.mitgliedId, A));
    pruefe("Betrag in DB = 10.00", bA?.betrag === "10.00", String(bA?.betrag));

    // Plus, rechtzeitig (>2 h) → keine Gebühr, kein Betrag.
    const B = await member("B", tPlus.tarifId);
    const ktFrueh = await termin(kMitPreis.kurstypId, 48);
    await bucheKurstermin(B, ktFrueh);
    const rB = await storniereBuchung(B, ktFrueh);
    pruefe("Plus rechtzeitig → keine Gebühr, betrag null", rB.status === "storniert" && rB.gebuehrFaellig === false && rB.betrag === null, JSON.stringify(rB));

    // Premium, innerhalb Frist → befreit, kein Betrag.
    const P = await member("P", tPrem.tarifId);
    const ktPrem = await termin(kMitPreis.kurstypId, 1);
    await bucheKurstermin(P, ktPrem);
    const rP = await storniereBuchung(P, ktPrem);
    pruefe("Premium innerhalb Frist → befreit, betrag null", rP.status === "storniert" && rP.gebuehrFaellig === false && rP.betrag === null, JSON.stringify(rP));

    console.log("Storno ohne hinterlegten Preis (HIIT):");
    // Plus, innerhalb Frist, aber Kurstyp ohne Preis → Flag ja, Betrag null.
    const C = await member("C", tPlus.tarifId);
    const ktOhne = await termin(kOhnePreis.kurstypId, 1);
    await bucheKurstermin(C, ktOhne);
    const rC = await storniereBuchung(C, ktOhne);
    pruefe("kein Preis → Gebühr-Flag ja, Betrag null", rC.status === "storniert" && rC.gebuehrFaellig === true && rC.betrag === null, JSON.stringify(rC));
  } finally {
    await db.update(kurstyp).set({ einzelpreis: preisVorherYoga }).where(eq(kurstyp.kurstypId, kMitPreis.kurstypId));
    await db.update(kurstyp).set({ einzelpreis: preisVorherHiit }).where(eq(kurstyp.kurstypId, kOhnePreis.kurstypId));
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
