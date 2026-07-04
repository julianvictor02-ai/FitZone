import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, kurstyp, trainer, mitglied, kurstermin, buchung, wartelisteneintrag } from "../lib/db/schema";
import { bucheKurstermin } from "../lib/booking/buchung";
import { warteAufKurstermin } from "../lib/booking/warteliste";
import { sageKursterminAb, verschiebeKurstermin } from "../lib/kurstermin/status";

// Verifiziert FZ-009 (BR8) gegen die echte DB: Statuswechsel abgesagt/verschoben
// benachrichtigt alle Betroffenen (Buchung + Warteliste), Übergangsregeln (spec §2),
// Start-Validierung. Self-cleaning.

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
    .values({ name: `Ab ${s}`, email: `ab-tr-${s}@verify.test` })
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
  async function statusVon(id: string) {
    const [k] = await db.select({ status: kurstermin.status, start: kurstermin.start }).from(kurstermin).where(eq(kurstermin.kursterminId, id));
    return k;
  }

  try {
    // --- Absagen benachrichtigt Buchung + Warteliste ---
    console.log("Absagen (Buchung + Warteliste benachrichtigen):");
    const A = await member("A");
    const B = await member("B");
    const kt = await termin(1, inStunden(48)); // kap=1
    await bucheKurstermin(A, kt); // voll → A gebucht
    await warteAufKurstermin(B, kt); // B wartend

    const rAb = await sageKursterminAb(kt);
    pruefe("Absagen → geaendert", rAb.status === "geaendert", rAb.status);
    const empf = rAb.status === "geaendert" ? [...rAb.benachrichtigt].sort() : [];
    pruefe(
      "benachrichtigt = gebuchtes A + wartendes B (ohne Duplikate)",
      empf.length === 2 && empf.includes(A) && empf.includes(B),
      JSON.stringify(empf),
    );
    pruefe("Status = abgesagt", (await statusVon(kt))?.status === "abgesagt");

    // --- Erneutes Absagen unzulässig ---
    const rAb2 = await sageKursterminAb(kt);
    pruefe("abgesagt → erneut absagen unzulässig", rAb2.status === "uebergang_unzulaessig", rAb2.status);

    // --- Verschieben ---
    console.log("Verschieben:");
    const C = await member("C");
    const ktV = await termin(5, inStunden(48));
    await bucheKurstermin(C, ktV);
    const neuerStart = inStunden(72);
    const rV = await verschiebeKurstermin(ktV, neuerStart);
    pruefe("Verschieben → geaendert", rV.status === "geaendert", rV.status);
    pruefe(
      "benachrichtigt = gebuchtes C",
      rV.status === "geaendert" && rV.benachrichtigt.length === 1 && rV.benachrichtigt[0] === C,
      JSON.stringify(rV),
    );
    const nach = await statusVon(ktV);
    pruefe(
      "Status = verschoben + neuer Start gesetzt",
      nach?.status === "verschoben" && Math.abs((nach.start?.getTime() ?? 0) - neuerStart.getTime()) < 1000,
      JSON.stringify(nach),
    );

    // --- verschoben → verschieben unzulässig, aber → absagen zulässig ---
    const rV2 = await verschiebeKurstermin(ktV, inStunden(96));
    pruefe("verschoben → erneut verschieben unzulässig", rV2.status === "uebergang_unzulaessig", rV2.status);
    const rVab = await sageKursterminAb(ktV);
    pruefe("verschoben → absagen zulässig", rVab.status === "geaendert", rVab.status);

    // --- Start-Validierung + nicht gefunden ---
    console.log("Validierung:");
    const ktP = await termin(5, inStunden(48));
    const rPast = await verschiebeKurstermin(ktP, inStunden(-1)); // Vergangenheit
    pruefe("Verschieben in die Vergangenheit → ungueltiger_start", rPast.status === "ungueltiger_start", rPast.status);

    const rNf = await sageKursterminAb("00000000-0000-0000-0000-000000000000");
    pruefe("unbekannter Termin → nicht_gefunden", rNf.status === "nicht_gefunden", rNf.status);

    // --- Ohne Betroffene → leere Empfängerliste ---
    const ktLeer = await termin(5, inStunden(48));
    const rLeer = await sageKursterminAb(ktLeer);
    pruefe(
      "Termin ohne Buchungen/Warteliste → geaendert, keine Empfänger",
      rLeer.status === "geaendert" && rLeer.benachrichtigt.length === 0,
      JSON.stringify(rLeer),
    );
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
