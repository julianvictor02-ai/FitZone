import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import {
  tarif,
  kurstyp,
  trainer,
  mitglied,
  kurstermin,
  buchung,
} from "../lib/db/schema";
import { bucheKurstermin } from "../lib/booking/buchung";

// Verifiziert FZ-001 (BR1) gegen die echte DB. Legt temporäre Testdaten an,
// prüft die Akzeptanzkriterien und räumt am Ende alles wieder auf.
// Ausführen: env laden, dann `tsx scripts/verify-fz001.ts`.

let bestanden = 0;
let fehlgeschlagen = 0;

function pruefe(name: string, ok: boolean, detail?: string) {
  if (ok) {
    bestanden++;
    console.log(`  ✓ ${name}`);
  } else {
    fehlgeschlagen++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const s = Date.now();
  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));
  const [kYoga] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));
  if (!tPlus || !kYoga) throw new Error("Seed fehlt (Tarif Plus / Kurstyp Yoga).");

  const [tr] = await db
    .insert(trainer)
    .values({ name: `Verify ${s}`, email: `trainer-${s}@verify.test` })
    .returning();
  const [mA] = await db
    .insert(mitglied)
    .values({ name: "Verify A", email: `a-${s}@verify.test`, tarifId: tPlus.tarifId })
    .returning();
  const [mB] = await db
    .insert(mitglied)
    .values({ name: "Verify B", email: `b-${s}@verify.test`, tarifId: tPlus.tarifId })
    .returning();

  const morgen = new Date(Date.now() + 86_400_000);
  const [kt1] = await db
    .insert(kurstermin)
    .values({ kurstypId: kYoga.kurstypId, trainerId: tr.trainerId, modus: "Studio", start: morgen, kapazitaet: 1, status: "geplant" })
    .returning();
  const [kt2] = await db
    .insert(kurstermin)
    .values({ kurstypId: kYoga.kurstypId, trainerId: tr.trainerId, modus: "Studio", start: morgen, kapazitaet: 1, status: "geplant" })
    .returning();

  try {
    console.log("FZ-001 — Akzeptanzkriterien (BR1):");

    // 1. Buchung bei freiem Platz → bestätigt + Zeitstempel
    const r1 = await bucheKurstermin(mA.mitgliedId, kt1.kursterminId);
    pruefe(
      "freier Platz → auto-bestätigt mit Nachweis-Zeitstempel",
      r1.status === "bestaetigt" && r1.buchungszeitpunkt instanceof Date,
      `status=${r1.status}`,
    );

    // 2. Doppelbuchung → bereits_gebucht
    const r2 = await bucheKurstermin(mA.mitgliedId, kt1.kursterminId);
    pruefe("Doppelbuchung wird verhindert", r2.status === "bereits_gebucht", `status=${r2.status}`);

    // 3. Voller Kurs (kapazitaet=1) → voll
    const r3 = await bucheKurstermin(mB.mitgliedId, kt1.kursterminId);
    pruefe("voller Kurs → voll (kein Überbuchen)", r3.status === "voll", `status=${r3.status}`);

    // 4. Nebenläufigkeit: zwei buchen gleichzeitig den letzten Platz → genau einer gewinnt
    const [c1, c2] = await Promise.all([
      bucheKurstermin(mA.mitgliedId, kt2.kursterminId),
      bucheKurstermin(mB.mitgliedId, kt2.kursterminId),
    ]);
    const bestaetigt = [c1, c2].filter((r) => r.status === "bestaetigt").length;
    const voll = [c1, c2].filter((r) => r.status === "voll").length;
    pruefe(
      "gleichzeitiges Buchen des letzten Platzes → genau 1x bestätigt, 1x voll",
      bestaetigt === 1 && voll === 1,
      `bestaetigt=${bestaetigt}, voll=${voll}`,
    );

    // 5. Neubuchung nach Storno erlaubt (partieller Unique-Index)
    await db
      .update(buchung)
      .set({ buchungsstatus: "storniert", stornozeitpunkt: new Date() })
      .where(and(eq(buchung.mitgliedId, mA.mitgliedId), eq(buchung.kursterminId, kt1.kursterminId)));
    const r5 = await bucheKurstermin(mA.mitgliedId, kt1.kursterminId);
    pruefe("Neubuchung nach Storno möglich (Historie bleibt)", r5.status === "bestaetigt", `status=${r5.status}`);
  } finally {
    // Aufräumen (FK-Reihenfolge: buchung → kurstermin/mitglied → trainer)
    await db.delete(buchung).where(eq(buchung.kursterminId, kt1.kursterminId));
    await db.delete(buchung).where(eq(buchung.kursterminId, kt2.kursterminId));
    await db.delete(kurstermin).where(eq(kurstermin.kursterminId, kt1.kursterminId));
    await db.delete(kurstermin).where(eq(kurstermin.kursterminId, kt2.kursterminId));
    await db.delete(mitglied).where(eq(mitglied.mitgliedId, mA.mitgliedId));
    await db.delete(mitglied).where(eq(mitglied.mitgliedId, mB.mitgliedId));
    await db.delete(trainer).where(eq(trainer.trainerId, tr.trainerId));
  }

  console.log(`\nErgebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen.`);
  process.exit(fehlgeschlagen === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
