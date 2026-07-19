import { and, eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { onDemandVideo } from "../lib/db/schema";
import { extrahiereYoutubeId } from "../lib/content/youtube";
import { erlaubteVideoTarife, type TarifName } from "../lib/content/zugriff";

// Verifiziert FZ-027: (1) robuste YouTube-ID-Extraktion aus gängigen Linkformaten,
// (2) Anlegen als OnDemandVideo (plattform=YouTube, url=ID), (3) tarif-gefilterte
// Sichtbarkeit inkl. Soft-Delete (geloescht) — analog zur Query in app/videos/page.tsx.
// Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

// Entspricht der Videoliste-Query von app/videos/page.tsx (Tarif-Filter + geloescht=false).
async function sichtbareVideos(tarifName: TarifName, videoIds: string[]): Promise<Set<string>> {
  const erlaubt = erlaubteVideoTarife(tarifName);
  if (erlaubt.length === 0) return new Set();
  const rows = await db
    .select({ id: onDemandVideo.videoId })
    .from(onDemandVideo)
    .where(and(inArray(onDemandVideo.mindestTarif, erlaubt), eq(onDemandVideo.geloescht, false)));
  return new Set(rows.map((r) => r.id).filter((id) => videoIds.includes(id)));
}

async function main() {
  const s = Date.now();
  const vIds: string[] = [];
  const ID = "dQw4w9WgXcQ";

  try {
    // --- (1) ID-Extraktion aus gängigen Formaten ---
    console.log("YouTube-ID-Extraktion (extrahiereYoutubeId):");
    pruefe("watch?v=ID", extrahiereYoutubeId(`https://www.youtube.com/watch?v=${ID}`) === ID);
    pruefe("watch?v=ID mit &t=", extrahiereYoutubeId(`https://www.youtube.com/watch?v=${ID}&t=42s`) === ID);
    pruefe("youtu.be/ID", extrahiereYoutubeId(`https://youtu.be/${ID}`) === ID);
    pruefe("youtu.be/ID mit ?t=", extrahiereYoutubeId(`https://youtu.be/${ID}?t=42`) === ID);
    pruefe("youtube.com/embed/ID", extrahiereYoutubeId(`https://www.youtube.com/embed/${ID}`) === ID);
    pruefe("youtube-nocookie embed", extrahiereYoutubeId(`https://www.youtube-nocookie.com/embed/${ID}`) === ID);
    pruefe("ohne Schema (youtu.be/ID)", extrahiereYoutubeId(`youtu.be/${ID}`) === ID);
    pruefe("reine Video-ID", extrahiereYoutubeId(ID) === ID);

    console.log("Ungültige Eingaben liefern null (kein Speichern):");
    pruefe("leerer String", extrahiereYoutubeId("") === null);
    pruefe("Nicht-YouTube-URL", extrahiereYoutubeId("https://vimeo.com/12345") === null);
    pruefe("Kauderwelsch", extrahiereYoutubeId("kein link") === null);
    pruefe("zu kurze ID", extrahiereYoutubeId("https://youtu.be/abc") === null);

    // --- (2) Anlegen wie die Server-Action erstelleVideo ---
    const extrahiert = extrahiereYoutubeId(`https://www.youtube.com/watch?v=${ID}`)!;
    const [vPlus] = await db
      .insert(onDemandVideo)
      .values({ titel: `yt-plus-${s}`, mindestTarif: "Plus", plattform: "YouTube", url: extrahiert })
      .returning();
    const [vPrem] = await db
      .insert(onDemandVideo)
      .values({ titel: `yt-prem-${s}`, mindestTarif: "Premium", plattform: "YouTube", url: extrahiert })
      .returning();
    vIds.push(vPlus.videoId, vPrem.videoId);

    console.log("Anlegen (OnDemandVideo, plattform=YouTube, url=ID):");
    pruefe("plattform ist YouTube", vPlus.plattform === "YouTube");
    pruefe("url = extrahierte Video-ID", vPlus.url === ID);

    // --- (3) tarif-gefilterte Sichtbarkeit ---
    console.log("Sichtbarkeit bei Mitgliedern (server-seitig gefiltert):");
    const basicSicht = await sichtbareVideos("Basic", vIds);
    pruefe("Basic: nicht sichtbar", basicSicht.size === 0, `${basicSicht.size}`);

    const plusSicht = await sichtbareVideos("Plus", vIds);
    pruefe("Plus: Plus-Video sichtbar", plusSicht.has(vPlus.videoId));
    pruefe("Plus: Premium-Video NICHT sichtbar", !plusSicht.has(vPrem.videoId));

    const premSicht = await sichtbareVideos("Premium", vIds);
    pruefe("Premium: beide sichtbar", premSicht.has(vPlus.videoId) && premSicht.has(vPrem.videoId));

    // --- (4) Soft-Delete blendet aus ---
    console.log("Soft-Delete (geloescht=true):");
    await db.update(onDemandVideo).set({ geloescht: true }).where(eq(onDemandVideo.videoId, vPlus.videoId));
    const plusNachDelete = await sichtbareVideos("Plus", vIds);
    pruefe("gelöschtes Video für Plus nicht mehr sichtbar", !plusNachDelete.has(vPlus.videoId));
    pruefe("anderes Video weiterhin sichtbar (Premium)", (await sichtbareVideos("Premium", vIds)).has(vPrem.videoId));
  } finally {
    if (vIds.length) await db.delete(onDemandVideo).where(inArray(onDemandVideo.videoId, vIds));
  }

  console.log(`\nErgebnis: ${fehler === 0 ? "ALLE OK" : `${fehler} fehlgeschlagen`}`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
