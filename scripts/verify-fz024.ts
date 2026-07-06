import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { kurstyp, trainer, kurstermin } from "../lib/db/schema";
import { schlageKursterminVor } from "../lib/kurstermin/vorschlag";

// Verifiziert FZ-024: der Trainer kann keinen zeitlich überlappenden Kurs vorschlagen.
// Überlappung [start, start+dauer); angrenzend (Ende == Start) ist erlaubt; abgesagte
// Termine blockieren nicht; Alt-Termine ohne Dauer nutzen die Fallback-Dauer. Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

async function main() {
  const s = Date.now();
  const [kYoga] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));
  const [tr] = await db
    .insert(trainer)
    .values({ name: `Kollision ${s}`, email: `kollision-${s}@verify.test` })
    .returning();

  const ktIds: string[] = [];
  // Fester Anker in der Zukunft (volle Stunde, damit die Rechnung klar ist).
  const anker = new Date(Date.now() + 72 * 3_600_000);
  anker.setMinutes(0, 0, 0);
  const plus = (min: number) => new Date(anker.getTime() + min * 60_000);
  const eingabe = (start: Date, dauer: number) => ({
    trainerId: tr.trainerId,
    kurstypId: kYoga.kurstypId,
    modus: "Studio" as const,
    start,
    dauerMinuten: dauer,
    kapazitaet: 10,
  });

  try {
    // Basis-Kurs 10:00–11:00 (anker + 0..60).
    const rBasis = await schlageKursterminVor(eingabe(plus(0), 60));
    pruefe("Basis-Kurs angelegt", rBasis.status === "vorgeschlagen", rBasis.status);
    if (rBasis.status === "vorgeschlagen") ktIds.push(rBasis.kursterminId);

    // Überlappend: 10:30–11:30 → Kollision.
    const rUeber = await schlageKursterminVor(eingabe(plus(30), 60));
    pruefe("überlappender Kurs → kollision", rUeber.status === "kollision", rUeber.status);
    if (rUeber.status === "vorgeschlagen") ktIds.push(rUeber.kursterminId);

    // Angrenzend: 11:00–12:00 (Ende == Start des Basis) → erlaubt.
    const rAngr = await schlageKursterminVor(eingabe(plus(60), 60));
    pruefe("angrenzender Kurs (Ende==Start) → erlaubt", rAngr.status === "vorgeschlagen", rAngr.status);
    if (rAngr.status === "vorgeschlagen") ktIds.push(rAngr.kursterminId);

    // Abgesagter Termin blockiert nicht: direkt als abgesagt einfügen bei 14:00–15:00.
    const [abg] = await db
      .insert(kurstermin)
      .values({ kurstypId: kYoga.kurstypId, trainerId: tr.trainerId, modus: "Studio", start: plus(240), dauerMinuten: 60, kapazitaet: 10, status: "abgesagt" })
      .returning({ id: kurstermin.kursterminId });
    ktIds.push(abg.id);
    const rTrotz = await schlageKursterminVor(eingabe(plus(240), 60));
    pruefe("abgesagter Termin blockiert nicht → erlaubt", rTrotz.status === "vorgeschlagen", rTrotz.status);
    if (rTrotz.status === "vorgeschlagen") ktIds.push(rTrotz.kursterminId);

    // Alt-Termin ohne Dauer (null) bei 18:00 → Fallback 60 Min → 18:30 überlappt.
    const [alt] = await db
      .insert(kurstermin)
      .values({ kurstypId: kYoga.kurstypId, trainerId: tr.trainerId, modus: "Studio", start: plus(480), dauerMinuten: null, kapazitaet: 10, status: "geplant" })
      .returning({ id: kurstermin.kursterminId });
    ktIds.push(alt.id);
    const rAlt = await schlageKursterminVor(eingabe(plus(510), 60));
    pruefe("Alt-Termin ohne Dauer nutzt Fallback → 18:30 kollidiert", rAlt.status === "kollision", rAlt.status);
    if (rAlt.status === "vorgeschlagen") ktIds.push(rAlt.kursterminId);

    // Anderer Trainer am selben Slot → keine Kollision (Prüfung ist trainer-genau).
    const [tr2] = await db
      .insert(trainer)
      .values({ name: `K2 ${s}`, email: `k2-${s}@verify.test` })
      .returning();
    const rAnder = await schlageKursterminVor({ ...eingabe(plus(0), 60), trainerId: tr2.trainerId });
    pruefe("anderer Trainer, selber Slot → erlaubt", rAnder.status === "vorgeschlagen", rAnder.status);
    if (rAnder.status === "vorgeschlagen") ktIds.push(rAnder.kursterminId);
    await db.delete(kurstermin).where(eq(kurstermin.trainerId, tr2.trainerId));
    await db.delete(trainer).where(eq(trainer.trainerId, tr2.trainerId));
  } finally {
    await db.delete(kurstermin).where(inArray(kurstermin.kursterminId, ktIds.length ? ktIds : [""]));
    await db.delete(trainer).where(eq(trainer.trainerId, tr.trainerId));
  }

  console.log(`\nErgebnis: ${fehler === 0 ? "ALLE OK" : `${fehler} fehlgeschlagen`}`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
