import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, mitglied, pushAbo } from "../lib/db/schema";
import { speicherePushAbo, entfernePushAbo, ladePushAbos, loeschePushAbo } from "../lib/push/abo";

// Verifiziert FZ-019 (Push-Abo-Schicht, ohne echten Versand): Upsert je endpoint,
// mehrere Geräte, mitglied-genaues Entfernen, Löschen abgelaufener Abos, Isolation.
// Der reale Web-Push-Versand ist nur im Browser prüfbar (Berechtigung/Zustellung).
// Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

async function main() {
  const s = Date.now();
  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));

  const mIds: string[] = [];
  async function member(tag: string): Promise<string> {
    const [m] = await db.insert(mitglied).values({ name: tag, email: `${tag}-${s}@verify.test`, tarifId: tPlus.tarifId }).returning();
    mIds.push(m.mitgliedId);
    return m.mitgliedId;
  }
  const sub = (e: string, k = "k") => ({ endpoint: `https://push.example/${e}-${s}`, p256dh: `${k}-p256`, auth: `${k}-auth` });

  try {
    const A = await member("A");
    const B = await member("B");

    console.log("Anlegen + Upsert:");
    await speicherePushAbo(A, sub("dev1"));
    let abosA = await ladePushAbos(A);
    pruefe("Abo angelegt", abosA.length === 1 && abosA[0].p256dh === "k-p256", JSON.stringify(abosA));

    // Gleicher endpoint erneut (Re-Subscribe) → Update statt Duplikat.
    await speicherePushAbo(A, { ...sub("dev1"), p256dh: "neu-p256", auth: "neu-auth" });
    abosA = await ladePushAbos(A);
    pruefe("gleicher endpoint → Upsert (kein Duplikat, Keys aktualisiert)", abosA.length === 1 && abosA[0].p256dh === "neu-p256", JSON.stringify(abosA));

    // Zweites Gerät → zweites Abo.
    await speicherePushAbo(A, sub("dev2"));
    abosA = await ladePushAbos(A);
    pruefe("zweites Gerät → 2 Abos", abosA.length === 2, JSON.stringify(abosA.map((a) => a.endpoint)));

    console.log("Entfernen (mitglied-genau) + Isolation:");
    // B versucht A's endpoint zu entfernen → wirkungslos (mitglied-Scope).
    await entfernePushAbo(B, sub("dev1").endpoint);
    pruefe("fremdes Mitglied kann Abo nicht entfernen", (await ladePushAbos(A)).length === 2);

    await entfernePushAbo(A, sub("dev1").endpoint);
    abosA = await ladePushAbos(A);
    pruefe("eigenes Abo entfernt → 1 übrig", abosA.length === 1 && abosA[0].endpoint === sub("dev2").endpoint, JSON.stringify(abosA.map((a) => a.endpoint)));

    // Abgelaufenes Abo per ID löschen (simuliert 404/410-Aufräumen im Versand).
    await loeschePushAbo(abosA[0].aboId);
    pruefe("loeschePushAbo(id) → 0 übrig", (await ladePushAbos(A)).length === 0);

    console.log("Isolation zwischen Mitgliedern:");
    await speicherePushAbo(B, sub("bdev"));
    pruefe("ladePushAbos liefert nur eigene", (await ladePushAbos(B)).length === 1 && (await ladePushAbos(A)).length === 0);
  } finally {
    await db.delete(pushAbo).where(inArray(pushAbo.mitgliedId, mIds));
    await db.delete(mitglied).where(inArray(mitglied.mitgliedId, mIds));
  }

  console.log(`\nErgebnis: ${fehler === 0 ? "ALLE OK" : `${fehler} fehlgeschlagen`}`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
