import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { kurstyp, trainer, kurstermin } from "../lib/db/schema";
import {
  schlageKursterminVor,
  bearbeiteVorschlag,
  zieheVorschlagZurueck,
  gibKursterminFrei,
  type VorschlagFelder,
} from "../lib/kurstermin/vorschlag";

// Verifiziert FZ-026: Trainer bearbeitet/zieht eigene Vorschläge zurück — nur eigene, nur
// im Status vorgeschlagen; Validierung + Kollision (Selbst ausgeklammert). Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

async function main() {
  const s = Date.now();
  const [kYoga] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));
  const [tr] = await db.insert(trainer).values({ name: `Edit ${s}`, email: `edit-${s}@verify.test` }).returning();
  const [trX] = await db.insert(trainer).values({ name: `EditX ${s}`, email: `editx-${s}@verify.test` }).returning();

  const ktIds: string[] = [];
  const inStunden = (h: number) => new Date(Date.now() + h * 3_600_000);
  const felder = (h: number, dauer = 60, kap = 10): VorschlagFelder => ({
    kurstypId: kYoga.kurstypId,
    modus: "Studio",
    start: inStunden(h),
    dauerMinuten: dauer,
    kapazitaet: kap,
  });
  async function vorschlag(h: number): Promise<string> {
    const r = await schlageKursterminVor({ trainerId: tr.trainerId, ...felder(h) });
    if (r.status !== "vorgeschlagen") throw new Error(`Setup fehlgeschlagen: ${JSON.stringify(r)}`);
    ktIds.push(r.kursterminId);
    return r.kursterminId;
  }
  async function daten(id: string) {
    const [k] = await db
      .select({ status: kurstermin.status, dauer: kurstermin.dauerMinuten, kap: kurstermin.kapazitaet })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, id));
    return k;
  }

  try {
    console.log("Zurückziehen:");
    const P1 = await vorschlag(48);
    const rFremd = await zieheVorschlagZurueck(trX.trainerId, P1);
    pruefe("fremder Trainer → nicht_dein_vorschlag", rFremd.status === "nicht_dein_vorschlag", rFremd.status);
    const rZur = await zieheVorschlagZurueck(tr.trainerId, P1);
    pruefe("eigener Vorschlag → zurueckgezogen", rZur.status === "zurueckgezogen", rZur.status);
    pruefe("Vorschlag danach gelöscht", (await daten(P1)) === undefined);

    console.log("Bearbeiten:");
    const P2 = await vorschlag(72);
    const rEdit = await bearbeiteVorschlag(tr.trainerId, P2, felder(72, 45, 8));
    pruefe("gültige Änderung → aktualisiert", rEdit.status === "aktualisiert", rEdit.status);
    const d = await daten(P2);
    pruefe("Dauer/Kapazität aktualisiert (45/8)", d?.dauer === 45 && d?.kap === 8, JSON.stringify(d));

    const rUng = await bearbeiteVorschlag(tr.trainerId, P2, felder(72, 0, 8));
    pruefe("ungültige Dauer → ungueltige_eingabe(dauer)", rUng.status === "ungueltige_eingabe" && rUng.feld === "dauer", JSON.stringify(rUng));

    const rFremd2 = await bearbeiteVorschlag(trX.trainerId, P2, felder(72));
    pruefe("fremder Trainer bearbeitet → nicht_dein_vorschlag", rFremd2.status === "nicht_dein_vorschlag", rFremd2.status);

    // Kollision: P3 an anderem Slot, dann auf P2s Slot bearbeiten → überlappt P2.
    const P3 = await vorschlag(96);
    const rKoll = await bearbeiteVorschlag(tr.trainerId, P3, felder(72));
    pruefe("Bearbeiten in Überlappung mit P2 → kollision", rKoll.status === "kollision", rKoll.status);
    pruefe("kollision nennt P2", rKoll.status === "kollision" && rKoll.mitKursterminId === P2, JSON.stringify(rKoll));

    // Nach Freigabe nicht mehr bearbeitbar.
    await gibKursterminFrei(P2);
    const rGeplant = await bearbeiteVorschlag(tr.trainerId, P2, felder(72, 50, 9));
    pruefe("freigegebener Termin → nicht_vorgeschlagen", rGeplant.status === "nicht_vorgeschlagen", rGeplant.status);

    const rNf = await bearbeiteVorschlag(tr.trainerId, "00000000-0000-0000-0000-000000000000", felder(120));
    pruefe("unbekannter Termin → nicht_gefunden", rNf.status === "nicht_gefunden", rNf.status);
  } finally {
    await db.delete(kurstermin).where(inArray(kurstermin.kursterminId, ktIds.length ? ktIds : [""]));
    await db.delete(trainer).where(inArray(trainer.trainerId, [tr.trainerId, trX.trainerId]));
  }

  console.log(`\nErgebnis: ${fehler === 0 ? "ALLE OK" : `${fehler} fehlgeschlagen`}`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
