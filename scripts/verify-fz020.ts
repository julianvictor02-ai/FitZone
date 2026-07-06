import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, kurstyp, trainer, mitglied, kurstermin, buchung } from "../lib/db/schema";
import {
  schlageKursterminVor,
  gibKursterminFrei,
  lehneVorschlagAb,
} from "../lib/kurstermin/vorschlag";
import { bucheKurstermin } from "../lib/booking/buchung";

// Verifiziert FZ-020 gegen die echte DB: Trainer schlägt einen Kurstermin vor
// (Status vorgeschlagen → für Mitglieder unsichtbar/unbuchbar), Admin gibt frei
// (→ geplant, dann buchbar) oder lehnt ab (löscht). Eingabe-Validierung. Self-cleaning.

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
    .values({ name: `Vorschlag ${s}`, email: `vorschlag-${s}@verify.test` })
    .returning();
  const [m] = await db
    .insert(mitglied)
    .values({ name: `M ${s}`, email: `m-${s}@verify.test`, tarifId: tPlus.tarifId })
    .returning();

  const ktIds: string[] = [];
  const inStunden = (h: number) => new Date(Date.now() + h * 3_600_000);
  let stundenOffset = 48;
  const basis = () => ({
    trainerId: tr.trainerId,
    kurstypId: kYoga.kurstypId,
    modus: "Studio" as const,
    // Jeder Aufruf ein anderer Slot → keine ungewollte Kollision (FZ-024) in fz020.
    start: inStunden((stundenOffset += 3)),
    dauerMinuten: 60,
    kapazitaet: 10,
  });
  async function statusVon(id: string) {
    const [k] = await db
      .select({ status: kurstermin.status, streamLink: kurstermin.streamLink })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, id));
    return k;
  }

  try {
    // --- Trainer schlägt vor ---
    console.log("Vorschlagen (Trainer):");
    const rVor = await schlageKursterminVor(basis());
    pruefe("gültiger Vorschlag → vorgeschlagen", rVor.status === "vorgeschlagen", rVor.status);
    const ktId = rVor.status === "vorgeschlagen" ? rVor.kursterminId : "";
    if (ktId) ktIds.push(ktId);
    pruefe("Status in DB = vorgeschlagen", (await statusVon(ktId))?.status === "vorgeschlagen");

    // --- Für Mitglieder unsichtbar/unbuchbar, solange vorgeschlagen ---
    const rBuchVor = await bucheKurstermin(m.mitgliedId, ktId);
    pruefe(
      "vorgeschlagen → für Mitglied nicht buchbar",
      rBuchVor.status === "kurs_nicht_buchbar",
      rBuchVor.status,
    );

    // --- Im eigenen Trainer-Kursplan sichtbar (trainer_id, status != abgesagt) ---
    const plan = await db
      .select({ id: kurstermin.kursterminId })
      .from(kurstermin)
      .where(and(eq(kurstermin.trainerId, tr.trainerId), ne(kurstermin.status, "abgesagt")));
    pruefe(
      "Vorschlag erscheint im Trainer-Kursplan",
      plan.some((p) => p.id === ktId),
      JSON.stringify(plan),
    );

    // --- Admin gibt frei → geplant → jetzt buchbar ---
    console.log("Freigabe (Admin):");
    const rFrei = await gibKursterminFrei(ktId);
    pruefe("Freigabe → freigegeben", rFrei.status === "freigegeben", rFrei.status);
    pruefe("Status in DB = geplant", (await statusVon(ktId))?.status === "geplant");
    const rBuchNach = await bucheKurstermin(m.mitgliedId, ktId);
    pruefe("nach Freigabe → Mitglied kann buchen", rBuchNach.status === "bestaetigt", rBuchNach.status);

    // --- Doppelte Freigabe / unbekannt ---
    const rFrei2 = await gibKursterminFrei(ktId);
    pruefe("bereits geplant → nicht_vorgeschlagen", rFrei2.status === "nicht_vorgeschlagen", rFrei2.status);
    const rFreiNf = await gibKursterminFrei("00000000-0000-0000-0000-000000000000");
    pruefe("unbekannter Termin → nicht_gefunden", rFreiNf.status === "nicht_gefunden", rFreiNf.status);

    // --- Livestream: Link Pflicht + wird gespeichert ---
    console.log("Livestream + Validierung:");
    const rLsOhne = await schlageKursterminVor({ ...basis(), modus: "Livestream" });
    pruefe("Livestream ohne Link → ungueltige_eingabe(streamLink)", rLsOhne.status === "ungueltige_eingabe" && rLsOhne.feld === "streamLink", JSON.stringify(rLsOhne));
    const rLsMit = await schlageKursterminVor({ ...basis(), modus: "Livestream", streamLink: "https://stream.test/x" });
    pruefe("Livestream mit Link → vorgeschlagen", rLsMit.status === "vorgeschlagen", rLsMit.status);
    if (rLsMit.status === "vorgeschlagen") {
      ktIds.push(rLsMit.kursterminId);
      pruefe("Stream-Link gespeichert", (await statusVon(rLsMit.kursterminId))?.streamLink === "https://stream.test/x");
    }
    // Studio verwirft einen mitgegebenen Link (null).
    const rStudioLink = await schlageKursterminVor({ ...basis(), streamLink: "https://ignored.test" });
    if (rStudioLink.status === "vorgeschlagen") {
      ktIds.push(rStudioLink.kursterminId);
      pruefe("Studio → Stream-Link verworfen (null)", (await statusVon(rStudioLink.kursterminId))?.streamLink === null);
    }

    // --- Eingabe-Validierung ---
    const rPast = await schlageKursterminVor({ ...basis(), start: inStunden(-1) });
    pruefe("Start in Vergangenheit → ungueltige_eingabe(start)", rPast.status === "ungueltige_eingabe" && rPast.feld === "start", JSON.stringify(rPast));
    const rKap = await schlageKursterminVor({ ...basis(), kapazitaet: 0 });
    pruefe("Kapazität 0 → ungueltige_eingabe(kapazitaet)", rKap.status === "ungueltige_eingabe" && rKap.feld === "kapazitaet", JSON.stringify(rKap));
    const rKein = await schlageKursterminVor({ ...basis(), kurstypId: "" });
    pruefe("kein Kurstyp → ungueltige_eingabe(kurstyp)", rKein.status === "ungueltige_eingabe" && rKein.feld === "kurstyp", JSON.stringify(rKein));

    // --- Ablehnen löscht den Vorschlag ---
    console.log("Ablehnen (Admin):");
    const rNeu = await schlageKursterminVor(basis());
    const ablId = rNeu.status === "vorgeschlagen" ? rNeu.kursterminId : "";
    const rAbl = await lehneVorschlagAb(ablId);
    pruefe("Ablehnen → abgelehnt", rAbl.status === "abgelehnt", rAbl.status);
    pruefe("Vorschlag danach gelöscht", (await statusVon(ablId)) === undefined);
    // Ablehnen eines freigegebenen (geplanten) Termins ist nicht erlaubt.
    const rAblGeplant = await lehneVorschlagAb(ktId);
    pruefe("geplant → ablehnen unzulässig (nicht_vorgeschlagen)", rAblGeplant.status === "nicht_vorgeschlagen", rAblGeplant.status);
  } finally {
    await db.delete(buchung).where(inArray(buchung.kursterminId, ktIds.length ? ktIds : [""]));
    await db.delete(kurstermin).where(inArray(kurstermin.kursterminId, ktIds.length ? ktIds : [""]));
    await db.delete(mitglied).where(eq(mitglied.mitgliedId, m.mitgliedId));
    await db.delete(trainer).where(eq(trainer.trainerId, tr.trainerId));
  }

  console.log(`\nErgebnis: ${fehler === 0 ? "ALLE OK" : `${fehler} fehlgeschlagen`}`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
