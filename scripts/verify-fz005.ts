import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, kurstyp, trainer, mitglied, kurstermin, buchung } from "../lib/db/schema";
import { bucheKurstermin } from "../lib/booking/buchung";

// Verifiziert FZ-005 gegen die echte DB: die Trainer-Ansicht zeigt strikt nur eigene
// Kurse (§2b) samt deren Teilnehmern — keine fremden Termine/Namen. Prüft die Query
// der Trainer-Seite (app/trainer/page.tsx). Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

// Entspricht der Datenbeschaffung von app/trainer/page.tsx (eigene, nicht abgesagte
// Termine + bestätigte Teilnehmer je Termin).
async function trainerAnsicht(trainerId: string) {
  const termine = await db
    .select({ kursterminId: kurstermin.kursterminId, start: kurstermin.start })
    .from(kurstermin)
    .where(and(eq(kurstermin.trainerId, trainerId), ne(kurstermin.status, "abgesagt")));
  const ids = termine.map((t) => t.kursterminId);
  const teilnehmer = ids.length
    ? await db
        .select({ kursterminId: buchung.kursterminId, mitgliedId: buchung.mitgliedId, name: mitglied.name })
        .from(buchung)
        .innerJoin(mitglied, eq(buchung.mitgliedId, mitglied.mitgliedId))
        .where(and(inArray(buchung.kursterminId, ids), eq(buchung.buchungsstatus, "bestaetigt")))
        .orderBy(asc(mitglied.name))
    : [];
  return { termine, teilnehmer };
}

async function main() {
  const s = Date.now();
  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));
  const [kYoga] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));

  const trIds: string[] = [];
  const mIds: string[] = [];
  const ktIds: string[] = [];
  async function neuerTrainer(tag: string): Promise<string> {
    const [tr] = await db.insert(trainer).values({ name: tag, email: `${tag}-${s}@verify.test` }).returning();
    trIds.push(tr.trainerId);
    return tr.trainerId;
  }
  async function member(tag: string): Promise<{ id: string; name: string }> {
    const [m] = await db
      .insert(mitglied)
      .values({ name: tag, email: `${tag}-${s}@verify.test`, tarifId: tPlus.tarifId })
      .returning();
    mIds.push(m.mitgliedId);
    return { id: m.mitgliedId, name: m.name };
  }
  async function termin(trainerId: string, start: Date, status: "geplant" | "abgesagt" = "geplant"): Promise<string> {
    const [kt] = await db
      .insert(kurstermin)
      .values({ kurstypId: kYoga.kurstypId, trainerId, modus: "Studio", start, kapazitaet: 5, status })
      .returning();
    ktIds.push(kt.kursterminId);
    return kt.kursterminId;
  }
  const vorStunden = (h: number) => new Date(Date.now() - h * 3_600_000);
  const inStunden = (h: number) => new Date(Date.now() + h * 3_600_000);

  try {
    const marie = await neuerTrainer("Marie");
    const tom = await neuerTrainer("Tom");
    const mA = await member("teiln-A");
    const mB = await member("teiln-B");

    const ktMarieVergangen = await termin(marie, vorStunden(2)); // begonnen
    const ktMarieKuenftig = await termin(marie, inStunden(24)); // noch nicht begonnen
    const ktMarieAbgesagt = await termin(marie, vorStunden(2), "abgesagt");
    const ktTom = await termin(tom, vorStunden(2));

    await bucheKurstermin(mA.id, ktMarieVergangen);
    await bucheKurstermin(mB.id, ktTom);

    const ansicht = await trainerAnsicht(marie);
    const sichtbareTermine = new Set(ansicht.termine.map((t) => t.kursterminId));
    const sichtbareNamen = ansicht.teilnehmer.map((t) => t.name);

    console.log("Sichtbarkeit eigener Kurse (§2b):");
    pruefe("eigener (begonnener) Kurs sichtbar", sichtbareTermine.has(ktMarieVergangen));
    pruefe("eigener künftiger Kurs sichtbar (Kursplan)", sichtbareTermine.has(ktMarieKuenftig));
    pruefe("fremder Kurs (Tom) NICHT sichtbar", !sichtbareTermine.has(ktTom));
    pruefe("eigener abgesagter Kurs NICHT gelistet", !sichtbareTermine.has(ktMarieAbgesagt));

    console.log("Teilnehmer-Sichtbarkeit:");
    pruefe("eigener Teilnehmer (A) sichtbar", sichtbareNamen.includes(mA.name), sichtbareNamen.join(","));
    pruefe("fremder Teilnehmer (B) NICHT sichtbar", !sichtbareNamen.includes(mB.name), sichtbareNamen.join(","));

    console.log("Erfassbarkeit (ab Kursbeginn):");
    const jetzt = new Date();
    const erf = new Map(ansicht.termine.map((t) => [t.kursterminId, t.start <= jetzt]));
    pruefe("vergangener Kurs → erfassbar", erf.get(ktMarieVergangen) === true);
    pruefe("künftiger Kurs → nicht erfassbar", erf.get(ktMarieKuenftig) === false);
  } finally {
    await db.delete(buchung).where(inArray(buchung.kursterminId, ktIds));
    await db.delete(kurstermin).where(inArray(kurstermin.kursterminId, ktIds));
    await db.delete(mitglied).where(inArray(mitglied.mitgliedId, mIds));
    await db.delete(trainer).where(inArray(trainer.trainerId, trIds));
  }

  console.log(`\nErgebnis: ${fehler === 0 ? "ALLE OK" : `${fehler} fehlgeschlagen`}`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
