import { eq, inArray, or } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, mitglied, trainer, pushAbo } from "../lib/db/schema";
import {
  speicherePushAboTrainer,
  entfernePushAboTrainer,
  ladePushAbosTrainer,
  speicherePushAbo,
  ladePushAbos,
} from "../lib/push/abo";

// Verifiziert FZ-022 (Trainer-Push-Abo-Schicht, ohne echten Versand): Upsert je endpoint,
// mehrere Geräte, trainer-genaues Entfernen, Trennung Trainer- vs. Mitglieds-Abos.
// Realer Web-Push-Versand ist nur im Browser prüfbar. Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

async function main() {
  const s = Date.now();
  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));
  const [trA] = await db
    .insert(trainer)
    .values({ name: `TA ${s}`, email: `ta-${s}@verify.test` })
    .returning();
  const [trB] = await db
    .insert(trainer)
    .values({ name: `TB ${s}`, email: `tb-${s}@verify.test` })
    .returning();
  const [m] = await db
    .insert(mitglied)
    .values({ name: `M ${s}`, email: `m-${s}@verify.test`, tarifId: tPlus.tarifId })
    .returning();

  const sub = (e: string, k = "k") => ({
    endpoint: `https://push.example/${e}-${s}`,
    p256dh: `${k}-p256`,
    auth: `${k}-auth`,
  });

  try {
    console.log("Anlegen + Upsert (Trainer):");
    await speicherePushAboTrainer(trA.trainerId, sub("dev1"));
    let abosA = await ladePushAbosTrainer(trA.trainerId);
    pruefe("Trainer-Abo angelegt", abosA.length === 1 && abosA[0].p256dh === "k-p256", JSON.stringify(abosA));

    await speicherePushAboTrainer(trA.trainerId, { ...sub("dev1"), p256dh: "neu-p256", auth: "neu-auth" });
    abosA = await ladePushAbosTrainer(trA.trainerId);
    pruefe("gleicher endpoint → Upsert (kein Duplikat)", abosA.length === 1 && abosA[0].p256dh === "neu-p256", JSON.stringify(abosA));

    await speicherePushAboTrainer(trA.trainerId, sub("dev2"));
    abosA = await ladePushAbosTrainer(trA.trainerId);
    pruefe("zweites Gerät → 2 Abos", abosA.length === 2, JSON.stringify(abosA.map((a) => a.endpoint)));

    console.log("Entfernen (trainer-genau) + Isolation:");
    await entfernePushAboTrainer(trB.trainerId, sub("dev1").endpoint);
    pruefe("fremder Trainer kann Abo nicht entfernen", (await ladePushAbosTrainer(trA.trainerId)).length === 2);

    await entfernePushAboTrainer(trA.trainerId, sub("dev1").endpoint);
    abosA = await ladePushAbosTrainer(trA.trainerId);
    pruefe("eigenes Abo entfernt → 1 übrig", abosA.length === 1 && abosA[0].endpoint === sub("dev2").endpoint, JSON.stringify(abosA.map((a) => a.endpoint)));

    console.log("Trennung Trainer- vs. Mitglieds-Abo:");
    await speicherePushAbo(m.mitgliedId, sub("member-dev"));
    pruefe("Mitglieds-Abo taucht NICHT in Trainer-Abos auf", (await ladePushAbosTrainer(trA.trainerId)).every((a) => a.endpoint !== sub("member-dev").endpoint));
    pruefe("Trainer-Abo taucht NICHT in Mitglieds-Abos auf", (await ladePushAbos(m.mitgliedId)).every((a) => a.endpoint !== sub("dev2").endpoint));
  } finally {
    await db
      .delete(pushAbo)
      .where(or(eq(pushAbo.trainerId, trA.trainerId), eq(pushAbo.trainerId, trB.trainerId), eq(pushAbo.mitgliedId, m.mitgliedId)));
    await db.delete(mitglied).where(eq(mitglied.mitgliedId, m.mitgliedId));
    await db.delete(trainer).where(inArray(trainer.trainerId, [trA.trainerId, trB.trainerId]));
  }

  console.log(`\nErgebnis: ${fehler === 0 ? "ALLE OK" : `${fehler} fehlgeschlagen`}`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
