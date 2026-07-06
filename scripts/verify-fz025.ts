import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { kurstyp, trainer, kurstermin } from "../lib/db/schema";
import { verschiebeKurstermin } from "../lib/kurstermin/status";

// Verifiziert FZ-025: Admin-Verschieben prüft Trainer-Zeitkollision. Überlappung → kollision;
// angrenzend erlaubt; abgesagte ignoriert; der Termin selbst ist ausgeklammert. Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

async function main() {
  const s = Date.now();
  const [kYoga] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));
  const [tr] = await db
    .insert(trainer)
    .values({ name: `Move ${s}`, email: `move-${s}@verify.test` })
    .returning();
  const [trX] = await db
    .insert(trainer)
    .values({ name: `MoveX ${s}`, email: `movex-${s}@verify.test` })
    .returning();

  const anker = new Date(Date.now() + 72 * 3_600_000);
  anker.setMinutes(0, 0, 0);
  const plus = (min: number) => new Date(anker.getTime() + min * 60_000);
  const ktIds: string[] = [];
  async function termin(trainerId: string, min: number, status: "geplant" | "abgesagt", dauer: number | null = 60) {
    const [k] = await db
      .insert(kurstermin)
      .values({ kurstypId: kYoga.kurstypId, trainerId, modus: "Studio", start: plus(min), dauerMinuten: dauer, kapazitaet: 10, status })
      .returning({ id: kurstermin.kursterminId });
    ktIds.push(k.id);
    return k.id;
  }
  async function statusVon(id: string) {
    const [k] = await db.select({ status: kurstermin.status }).from(kurstermin).where(eq(kurstermin.kursterminId, id));
    return k?.status;
  }

  try {
    const A = await termin(tr.trainerId, 0, "geplant"); // 10:00–11:00 (Referenz)

    // Verschieben in die Überlappung mit A → kollision.
    const B1 = await termin(tr.trainerId, 180, "geplant");
    const r1 = await verschiebeKurstermin(B1, plus(30));
    pruefe("Verschieben in Überlappung → kollision", r1.status === "kollision", r1.status);
    pruefe("kollision nennt A", r1.status === "kollision" && r1.mitKursterminId === A, JSON.stringify(r1));
    pruefe("B1 bleibt geplant (nicht verschoben)", (await statusVon(B1)) === "geplant");

    // Angrenzend (11:00, Ende von A) → erlaubt.
    const B2 = await termin(tr.trainerId, 180, "geplant");
    const r2 = await verschiebeKurstermin(B2, plus(60));
    pruefe("Verschieben angrenzend → geaendert", r2.status === "geaendert", r2.status);

    // Abgesagter Termin blockiert nicht.
    await termin(tr.trainerId, 600, "abgesagt");
    const B3 = await termin(tr.trainerId, 900, "geplant");
    const r3 = await verschiebeKurstermin(B3, plus(600));
    pruefe("Verschieben auf Slot eines abgesagten Termins → geaendert", r3.status === "geaendert", r3.status);

    // Self-Exclusion: eigener Termin (trX, allein) minimal verschoben → keine Kollision mit sich.
    const X = await termin(trX.trainerId, 0, "geplant");
    const rX = await verschiebeKurstermin(X, plus(30));
    pruefe("Verschieben überlappt nur eigenen alten Slot → geaendert", rX.status === "geaendert", rX.status);
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
