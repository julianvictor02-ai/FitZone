import { and, eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, kurstyp, trainer, mitglied, kurstermin, buchung, wartelisteneintrag } from "../lib/db/schema";
import { bucheKurstermin } from "../lib/booking/buchung";
import { setzeTrainerNotiz } from "../lib/trainer/notiz";

// Verifiziert FZ-012 (§7 / §2b): Trainer-Notiz je Teilnehmer setzen/ändern/löschen,
// strikt nur eigene Kurse + aktive Buchungen. Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

async function main() {
  const s = Date.now();
  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));
  const [kYoga] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));
  const [trMine] = await db.insert(trainer).values({ name: `Mine ${s}`, email: `mine-${s}@verify.test` }).returning();
  const [trOther] = await db.insert(trainer).values({ name: `Other ${s}`, email: `other-${s}@verify.test` }).returning();

  const mIds: string[] = [];
  const ktIds: string[] = [];
  async function member(tag: string): Promise<string> {
    const [m] = await db.insert(mitglied).values({ name: tag, email: `${tag}-${s}@verify.test`, tarifId: tPlus.tarifId }).returning();
    mIds.push(m.mitgliedId);
    return m.mitgliedId;
  }
  async function termin(trainerId: string): Promise<string> {
    const [kt] = await db
      .insert(kurstermin)
      .values({ kurstypId: kYoga.kurstypId, trainerId, modus: "Studio", start: new Date(Date.now() + 48 * 3_600_000), kapazitaet: 5, status: "geplant" })
      .returning();
    ktIds.push(kt.kursterminId);
    return kt.kursterminId;
  }
  async function gespeicherteNotiz(mitgliedId: string, kursterminId: string) {
    const [b] = await db
      .select({ notiz: buchung.trainerNotiz })
      .from(buchung)
      .where(and(eq(buchung.mitgliedId, mitgliedId), eq(buchung.kursterminId, kursterminId), eq(buchung.buchungsstatus, "bestaetigt")));
    return b?.notiz ?? null;
  }

  try {
    const A = await member("A");
    const kt = await termin(trMine.trainerId);
    await bucheKurstermin(A, kt);

    console.log("Notiz setzen/ändern/löschen (eigener Kurs):");
    const r1 = await setzeTrainerNotiz(trMine.trainerId, kt, A, "wirkte verletzt");
    pruefe("Notiz gespeichert", r1.status === "gespeichert" && r1.notiz === "wirkte verletzt", JSON.stringify(r1));
    pruefe("Notiz in DB persistiert", (await gespeicherteNotiz(A, kt)) === "wirkte verletzt");

    const r2 = await setzeTrainerNotiz(trMine.trainerId, kt, A, "  neuer Text  ");
    pruefe("Notiz überschrieben + getrimmt", r2.status === "gespeichert" && r2.notiz === "neuer Text", JSON.stringify(r2));

    const r3 = await setzeTrainerNotiz(trMine.trainerId, kt, A, "   ");
    pruefe("leere Eingabe → Notiz gelöscht (null)", r3.status === "gespeichert" && r3.notiz === null, JSON.stringify(r3));
    pruefe("null in DB persistiert", (await gespeicherteNotiz(A, kt)) === null);

    console.log("Rechte/Isolation (§2b):");
    const rFremd = await setzeTrainerNotiz(trOther.trainerId, kt, A, "fremd");
    pruefe("fremder Trainer → nicht_dein_kurs", rFremd.status === "nicht_dein_kurs", rFremd.status);
    pruefe("fremder Schreibversuch blieb wirkungslos", (await gespeicherteNotiz(A, kt)) === null);

    const B = await member("B"); // nicht gebucht
    const rKeine = await setzeTrainerNotiz(trMine.trainerId, kt, B, "x");
    pruefe("Nicht-Teilnehmer → keine_buchung", rKeine.status === "keine_buchung", rKeine.status);

    const rNf = await setzeTrainerNotiz(trMine.trainerId, "00000000-0000-0000-0000-000000000000", A, "x");
    pruefe("unbekannter Kurs → kurs_nicht_gefunden", rNf.status === "kurs_nicht_gefunden", rNf.status);
  } finally {
    await db.delete(wartelisteneintrag).where(inArray(wartelisteneintrag.kursterminId, ktIds));
    await db.delete(buchung).where(inArray(buchung.kursterminId, ktIds));
    await db.delete(kurstermin).where(inArray(kurstermin.kursterminId, ktIds));
    await db.delete(mitglied).where(inArray(mitglied.mitgliedId, mIds));
    await db.delete(trainer).where(inArray(trainer.trainerId, [trMine.trainerId, trOther.trainerId]));
  }

  console.log(`\nErgebnis: ${fehler === 0 ? "ALLE OK" : `${fehler} fehlgeschlagen`}`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
