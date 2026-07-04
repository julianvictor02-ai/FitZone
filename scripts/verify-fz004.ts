import { and, eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, kurstyp, trainer, mitglied, kurstermin, buchung } from "../lib/db/schema";
import { bucheKurstermin } from "../lib/booking/buchung";
import { erfasseAnwesenheit } from "../lib/attendance/anwesenheit";

// Verifiziert FZ-004 gegen die echte DB: Anwesenheitserfassung mit Zeitstempel,
// Trainer-Ownership (§2b), Vor-Kurs-Sperre und Unveränderbarkeit des
// Nachweis-Zeitstempels (NFR). Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

async function main() {
  const s = Date.now();
  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));
  const [kYoga] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));

  const trIds: string[] = [];
  const mIds: string[] = [];
  const ktIds: string[] = [];
  async function neuerTrainer(tag: string): Promise<string> {
    const [tr] = await db
      .insert(trainer)
      .values({ name: tag, email: `${tag}-${s}@verify.test` })
      .returning();
    trIds.push(tr.trainerId);
    return tr.trainerId;
  }
  async function member(tag: string): Promise<string> {
    const [m] = await db
      .insert(mitglied)
      .values({ name: tag, email: `${tag}-${s}@verify.test`, tarifId: tPlus.tarifId })
      .returning();
    mIds.push(m.mitgliedId);
    return m.mitgliedId;
  }
  async function termin(trainerId: string, start: Date): Promise<string> {
    const [kt] = await db
      .insert(kurstermin)
      .values({ kurstypId: kYoga.kurstypId, trainerId, modus: "Studio", start, kapazitaet: 5, status: "geplant" })
      .returning();
    ktIds.push(kt.kursterminId);
    return kt.kursterminId;
  }
  const vorStunden = (h: number) => new Date(Date.now() - h * 3_600_000);
  const inStunden = (h: number) => new Date(Date.now() + h * 3_600_000);
  async function anwesenheitVon(mId: string, ktId: string) {
    const [b] = await db
      .select({ a: buchung.anwesenheit, erfasst: buchung.anwesenheitErfasstAm, ts: buchung.buchungszeitpunkt })
      .from(buchung)
      .where(and(eq(buchung.mitgliedId, mId), eq(buchung.kursterminId, ktId), eq(buchung.buchungsstatus, "bestaetigt")));
    return b;
  }

  try {
    const marie = await neuerTrainer("Marie");
    const tom = await neuerTrainer("Tom");

    // --- Erfassung durch den zuständigen Trainer (begonnener Kurs) ---
    console.log("Erfassung durch eigenen Trainer (Kurs begonnen):");
    const m1 = await member("teiln1");
    const ktPast = await termin(marie, vorStunden(1)); // Kurs hat begonnen
    await bucheKurstermin(m1, ktPast);

    const r1 = await erfasseAnwesenheit(marie, ktPast, m1, "anwesend");
    pruefe(
      "Trainer erfasst 'anwesend' → erfasst + Zeitstempel gesetzt",
      r1.status === "erfasst" && r1.erfasstAm instanceof Date,
      JSON.stringify(r1),
    );
    const nach1 = await anwesenheitVon(m1, ktPast);
    pruefe("DB: anwesenheit=anwesend, anwesenheit_erfasst_am gesetzt", nach1?.a === "anwesend" && nach1?.erfasst != null, JSON.stringify(nach1));

    // NFR: Nachweis-Zeitstempel unverändert
    const tsVorher = nach1?.ts?.getTime();
    await erfasseAnwesenheit(marie, ktPast, m1, "no_show");
    const nach2 = await anwesenheitVon(m1, ktPast);
    pruefe("no_show ebenfalls setzbar (Korrektur)", nach2?.a === "no_show", nach2?.a);
    pruefe("buchungszeitpunkt bleibt unverändert (NFR)", nach2?.ts?.getTime() === tsVorher, `${tsVorher} vs ${nach2?.ts?.getTime()}`);

    // Zurücksetzen auf offen → Zeitstempel geleert
    await erfasseAnwesenheit(marie, ktPast, m1, "offen");
    const nach3 = await anwesenheitVon(m1, ktPast);
    pruefe("Korrektur 'offen' → Zeitstempel wieder null", nach3?.a === "offen" && nach3?.erfasst == null, JSON.stringify(nach3));

    // --- Ownership: fremder Trainer darf nicht (§2b) ---
    console.log("Rechte / Ownership (§2b):");
    const rFremd = await erfasseAnwesenheit(tom, ktPast, m1, "anwesend");
    pruefe("fremder Trainer → nicht_dein_kurs", rFremd.status === "nicht_dein_kurs", rFremd.status);
    const nachFremd = await anwesenheitVon(m1, ktPast);
    pruefe("DB durch fremden Trainer unverändert (bleibt offen)", nachFremd?.a === "offen", nachFremd?.a);

    // --- Vor Kursbeginn nicht erfassbar ---
    console.log("Zeitliche Sperre:");
    const m2 = await member("teiln2");
    const ktFuture = await termin(marie, inStunden(24)); // Kurs noch nicht begonnen
    await bucheKurstermin(m2, ktFuture);
    const rFrueh = await erfasseAnwesenheit(marie, ktFuture, m2, "anwesend");
    pruefe("Kurs in der Zukunft → zu_frueh", rFrueh.status === "zu_frueh", rFrueh.status);

    // --- Kein aktiver Teilnehmer ---
    console.log("Fehlende Buchung / fehlender Kurs:");
    const m3 = await member("ungebucht");
    const rKeine = await erfasseAnwesenheit(marie, ktPast, m3, "anwesend");
    pruefe("nie gebuchtes Mitglied → keine_buchung", rKeine.status === "keine_buchung", rKeine.status);

    const rKein = await erfasseAnwesenheit(marie, "00000000-0000-0000-0000-000000000000", m1, "anwesend");
    pruefe("unbekannter Kurstermin → kurs_nicht_gefunden", rKein.status === "kurs_nicht_gefunden", rKein.status);
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
