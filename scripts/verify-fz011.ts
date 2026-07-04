import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, mitglied, onDemandVideo } from "../lib/db/schema";
import { darfVideoSehen, erlaubteVideoTarife, type TarifName } from "../lib/content/zugriff";

// Verifiziert FZ-011 (BR7) gegen die echte DB: On-Demand-Videos sind tarif-gefiltert
// sichtbar — Basic sieht keine, Plus nur Plus-Videos, Premium alle. Prüft die Zugriffs-
// regel und die Videoliste-Query (app/videos/page.tsx). Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

// Entspricht der Videoliste-Query von app/videos/page.tsx.
async function sichtbareVideos(tarifName: TarifName, videoIds: string[]): Promise<Set<string>> {
  const erlaubt = erlaubteVideoTarife(tarifName);
  if (erlaubt.length === 0) return new Set();
  const rows = await db
    .select({ id: onDemandVideo.videoId })
    .from(onDemandVideo)
    .where(inArray(onDemandVideo.mindestTarif, erlaubt));
  // nur die Test-Videos betrachten (DB kann Demo-Videos enthalten)
  return new Set(rows.map((r) => r.id).filter((id) => videoIds.includes(id)));
}

async function main() {
  const s = Date.now();
  const [tBasic] = await db.select().from(tarif).where(eq(tarif.name, "Basic"));
  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));
  const [tPrem] = await db.select().from(tarif).where(eq(tarif.name, "Premium"));

  const mIds: string[] = [];
  const vIds: string[] = [];
  async function member(tarifId: string): Promise<string> {
    const [m] = await db.insert(mitglied).values({ name: `m-${s}`, email: `m-${tarifId.slice(0, 8)}-${s}@verify.test`, tarifId }).returning();
    mIds.push(m.mitgliedId);
    return m.mitgliedId;
  }

  try {
    // --- Reine Zugriffsregel (BR7) ---
    console.log("Zugriffsregel darfVideoSehen (mitglied.tarif >= mindest_tarif):");
    pruefe("Basic sieht kein Plus-Video", darfVideoSehen("Basic", "Plus") === false);
    pruefe("Basic sieht kein Premium-Video", darfVideoSehen("Basic", "Premium") === false);
    pruefe("Plus sieht Plus-Video", darfVideoSehen("Plus", "Plus") === true);
    pruefe("Plus sieht KEIN Premium-Video", darfVideoSehen("Plus", "Premium") === false);
    pruefe("Premium sieht Plus- und Premium-Video", darfVideoSehen("Premium", "Plus") && darfVideoSehen("Premium", "Premium"));

    // --- Videoliste-Query je Tarif ---
    const [vPlus] = await db.insert(onDemandVideo).values({ titel: `plus-${s}`, mindestTarif: "Plus", plattform: "Vimeo", url: "https://v/plus" }).returning();
    const [vPrem] = await db.insert(onDemandVideo).values({ titel: `prem-${s}`, mindestTarif: "Premium", plattform: "Vimeo", url: "https://v/prem" }).returning();
    vIds.push(vPlus.videoId, vPrem.videoId);

    const mBasic = await member(tBasic.tarifId);
    const mPlus = await member(tPlus.tarifId);
    const mPrem = await member(tPrem.tarifId);
    void mBasic; void mPlus; void mPrem; // Sichtbarkeit hängt am Tarif, nicht am Member-Datensatz

    console.log("Videoliste (server-seitig gefiltert):");
    const basicSicht = await sichtbareVideos("Basic", vIds);
    pruefe("Basic: keine Videos sichtbar", basicSicht.size === 0, `${basicSicht.size}`);

    const plusSicht = await sichtbareVideos("Plus", vIds);
    pruefe("Plus: Plus-Video sichtbar", plusSicht.has(vPlus.videoId));
    pruefe("Plus: Premium-Video NICHT sichtbar", !plusSicht.has(vPrem.videoId));

    const premSicht = await sichtbareVideos("Premium", vIds);
    pruefe("Premium: Plus- und Premium-Video sichtbar", premSicht.has(vPlus.videoId) && premSicht.has(vPrem.videoId));
  } finally {
    await db.delete(mitglied).where(inArray(mitglied.mitgliedId, mIds));
    if (vIds.length) await db.delete(onDemandVideo).where(inArray(onDemandVideo.videoId, vIds));
  }

  console.log(`\nErgebnis: ${fehler === 0 ? "ALLE OK" : `${fehler} fehlgeschlagen`}`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
