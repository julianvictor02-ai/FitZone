import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, kurstyp, trainer, mitglied, kurstermin, buchung, wartelisteneintrag } from "../lib/db/schema";
import { bucheKurstermin } from "../lib/booking/buchung";
import { warteAufKurstermin, verarbeiteWarteliste } from "../lib/booking/warteliste";
import { storniereBuchung } from "../lib/booking/storno";
import { erfasseAnwesenheit } from "../lib/attendance/anwesenheit";
import { ladeNachweisEreignisse, type NachweisVorgang } from "../lib/audit/nachweis";

// Verifiziert FZ-008 (§6 NFR): jeder Vorgang erscheint mit seinem unveränderbaren
// Zeitstempel im konsolidierten Nachweis-Log, chronologisch (neueste zuerst).
// Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

async function main() {
  const s = Date.now();
  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));
  const [kYoga] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));
  const [tr] = await db
    .insert(trainer)
    .values({ name: `Nw ${s}`, email: `nw-tr-${s}@verify.test` })
    .returning();

  const mIds: string[] = [];
  const ktIds: string[] = [];
  async function member(tag: string): Promise<string> {
    const [m] = await db
      .insert(mitglied)
      .values({ name: tag, email: `${tag}-${s}@verify.test`, tarifId: tPlus.tarifId })
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
    // A: bucht (rechtzeitig) und storniert → 2 Vorgänge.
    const A = await member("A");
    const ktZukunft = await termin(5, inStunden(48));
    await bucheKurstermin(A, ktZukunft);
    await storniereBuchung(A, ktZukunft);

    // B: bucht einen vergangenen Kurs, Trainer erfasst Anwesenheit → 2 Vorgänge.
    const B = await member("B");
    const ktVergangen = await termin(5, inStunden(-2)); // Start in der Vergangenheit
    await bucheKurstermin(B, ktVergangen);
    await erfasseAnwesenheit(tr.trainerId, ktVergangen, B, "anwesend");

    // C + D: voller Kurs → D landet auf Warteliste; C storniert → D wird benachrichtigt.
    const C = await member("C");
    const D = await member("D");
    const ktVoll = await termin(1, inStunden(48));
    await bucheKurstermin(C, ktVoll);
    await warteAufKurstermin(D, ktVoll);
    await storniereBuchung(C, ktVoll); // löst Nachrücken (D → benachrichtigt) aus
    await verarbeiteWarteliste(ktVoll); // idempotent, stellt Angebot sicher

    // --- Nachweis-Log lesen (nur unsere Mitglieder) ---
    const ev = await ladeNachweisEreignisse({ mitgliedIds: [A, B, C, D], limit: 500 });
    const hat = (m: string, v: NachweisVorgang) => ev.some((e) => e.mitgliedId === m && e.vorgang === v);

    console.log("Jeder Vorgang mit Zeitstempel im Log:");
    pruefe("A: gebucht erfasst", hat(A, "gebucht"));
    pruefe("A: storniert erfasst", hat(A, "storniert"));
    pruefe("B: gebucht erfasst", hat(B, "gebucht"));
    pruefe("B: anwesenheit_erfasst erfasst", hat(B, "anwesenheit_erfasst"));
    pruefe("C: gebucht + storniert erfasst", hat(C, "gebucht") && hat(C, "storniert"));
    pruefe("D: warteliste_beigetreten erfasst", hat(D, "warteliste_beigetreten"));
    pruefe("D: nachrueck_angebot erfasst", hat(D, "nachrueck_angebot"));

    console.log("Eigenschaften des Logs:");
    pruefe("jedes Ereignis trägt einen Zeitstempel", ev.every((e) => e.zeitpunkt instanceof Date && !isNaN(e.zeitpunkt.getTime())));
    const zeiten = ev.map((e) => e.zeitpunkt.getTime());
    const sortiert = zeiten.every((t, i) => i === 0 || zeiten[i - 1] >= t);
    pruefe("chronologisch, neueste zuerst", sortiert);

    // Anwesenheits-Detail wird mitgeführt.
    const anw = ev.find((e) => e.mitgliedId === B && e.vorgang === "anwesenheit_erfasst");
    pruefe("Anwesenheit-Detail = anwesend", anw?.detail === "anwesend", JSON.stringify(anw));

    // Storno-Zeitstempel ≠ Buchungs-Zeitstempel desselben Vorgangs (unabhängig nachweisbar).
    const aGebucht = ev.find((e) => e.mitgliedId === A && e.vorgang === "gebucht");
    const aStorno = ev.find((e) => e.mitgliedId === A && e.vorgang === "storniert");
    pruefe(
      "Buchungs- und Storno-Zeitstempel getrennt vorhanden",
      !!aGebucht && !!aStorno && aStorno!.zeitpunkt.getTime() >= aGebucht!.zeitpunkt.getTime(),
    );

    // mitgliedIds-Filter grenzt strikt ein (keine fremden Mitglieder).
    pruefe("Filter liefert nur angeforderte Mitglieder", ev.every((e) => [A, B, C, D].includes(e.mitgliedId)));
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
