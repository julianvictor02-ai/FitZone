import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { kurstyp, trainer, kurstermin } from "../lib/db/schema";
import { schlageKursterminVor } from "../lib/kurstermin/vorschlag";

// Verifiziert FZ-023: Kursdauer ist Pflicht, wird gespeichert, ungültige Werte abgewiesen.
// Self-cleaning.

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
    .values({ name: `Dauer ${s}`, email: `dauer-${s}@verify.test` })
    .returning();

  const ktIds: string[] = [];
  const inStunden = (h: number) => new Date(Date.now() + h * 3_600_000);
  const basis = (dauer: number) => ({
    trainerId: tr.trainerId,
    kurstypId: kYoga.kurstypId,
    modus: "Studio" as const,
    start: inStunden(48),
    dauerMinuten: dauer,
    kapazitaet: 10,
  });

  try {
    const rOk = await schlageKursterminVor(basis(45));
    pruefe("gültige Dauer → vorgeschlagen", rOk.status === "vorgeschlagen", rOk.status);
    if (rOk.status === "vorgeschlagen") {
      ktIds.push(rOk.kursterminId);
      const [k] = await db
        .select({ dauer: kurstermin.dauerMinuten })
        .from(kurstermin)
        .where(eq(kurstermin.kursterminId, rOk.kursterminId));
      pruefe("Dauer gespeichert (45)", k?.dauer === 45, JSON.stringify(k));
    }

    const rNull = await schlageKursterminVor(basis(0));
    pruefe("Dauer 0 → ungueltige_eingabe(dauer)", rNull.status === "ungueltige_eingabe" && rNull.feld === "dauer", JSON.stringify(rNull));

    const rNaN = await schlageKursterminVor(basis(Number.NaN));
    pruefe("Dauer NaN → ungueltige_eingabe(dauer)", rNaN.status === "ungueltige_eingabe" && rNaN.feld === "dauer", JSON.stringify(rNaN));

    const rNeg = await schlageKursterminVor(basis(-30));
    pruefe("Dauer negativ → ungueltige_eingabe(dauer)", rNeg.status === "ungueltige_eingabe" && rNeg.feld === "dauer", JSON.stringify(rNeg));
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
