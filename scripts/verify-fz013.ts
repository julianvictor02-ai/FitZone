import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, kurstyp, trainer, mitglied, kurstermin, buchung, wartelisteneintrag } from "../lib/db/schema";
import { ladeNoShowAuswertung, NO_SHOW_FENSTER_TAGE } from "../lib/attendance/noshow";
import type { AnwesenheitWert } from "../lib/attendance/anwesenheit";

// Verifiziert FZ-013 (BR6): No-Shows je Mitglied im Fenster, Hinweis ab Schwelle (=3),
// Fenster-Ausschluss, Premium wird getrackt (keine Auto-Sperre). Self-cleaning.

let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

async function main() {
  const s = Date.now();
  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));
  const [tPrem] = await db.select().from(tarif).where(eq(tarif.name, "Premium"));
  const [kYoga] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));
  const [tr] = await db.insert(trainer).values({ name: `Ns ${s}`, email: `ns-tr-${s}@verify.test` }).returning();

  const mIds: string[] = [];
  const ktIds: string[] = [];
  async function member(tag: string, tarifId: string): Promise<string> {
    const [m] = await db.insert(mitglied).values({ name: tag, email: `${tag}-${s}@verify.test`, tarifId }).returning();
    mIds.push(m.mitgliedId);
    return m.mitgliedId;
  }
  const vorTagen = (d: number) => new Date(Date.now() - d * 86_400_000);
  // Eine erfasste Buchung mit gegebener Anwesenheit zu einem (vergangenen) Kurs.
  async function buchungMit(mitgliedId: string, startVorTagen: number, wert: AnwesenheitWert) {
    const [kt] = await db
      .insert(kurstermin)
      .values({ kurstypId: kYoga.kurstypId, trainerId: tr.trainerId, modus: "Studio", start: vorTagen(startVorTagen), kapazitaet: 20, status: "geplant" })
      .returning();
    ktIds.push(kt.kursterminId);
    await db.insert(buchung).values({
      mitgliedId,
      kursterminId: kt.kursterminId,
      buchungsstatus: "bestaetigt",
      anwesenheit: wert,
      anwesenheitErfasstAm: new Date(),
    });
  }

  try {
    // X (Plus): 3 No-Shows im Fenster → Hinweis. Y (Plus): 2 → kein Hinweis.
    const X = await member("X", tPlus.tarifId);
    for (const d of [5, 10, 20]) await buchungMit(X, d, "no_show");
    const Y = await member("Y", tPlus.tarifId);
    for (const d of [5, 15]) await buchungMit(Y, d, "no_show");

    // Z (Plus): 1 No-Show im Fenster + 1 außerhalb (älter als Fenster) → zählt nur 1.
    const Z = await member("Z", tPlus.tarifId);
    await buchungMit(Z, 10, "no_show");
    await buchungMit(Z, NO_SHOW_FENSTER_TAGE + 15, "no_show");

    // W (Plus): nur anwesend → taucht nicht auf.
    const W = await member("W", tPlus.tarifId);
    await buchungMit(W, 5, "anwesend");

    // P (Premium): 3 No-Shows → wird getrackt + Hinweis (keine Auto-Sperre, BR6/W1).
    const P = await member("P", tPrem.tarifId);
    for (const d of [3, 8, 12]) await buchungMit(P, d, "no_show");

    const ausw = await ladeNoShowAuswertung({ mitgliedIds: [X, Y, Z, W, P] });
    const von = (id: string) => ausw.find((e) => e.mitgliedId === id);

    console.log("Zählung + Schwelle (=3):");
    pruefe("X: 3 No-Shows → Hinweis", von(X)?.anzahl === 3 && von(X)?.hinweis === true, JSON.stringify(von(X)));
    pruefe("Y: 2 No-Shows → kein Hinweis", von(Y)?.anzahl === 2 && von(Y)?.hinweis === false, JSON.stringify(von(Y)));
    pruefe("Z: nur 1 im Fenster (alte ausgeschlossen)", von(Z)?.anzahl === 1, JSON.stringify(von(Z)));
    pruefe("W: nur anwesend → nicht gelistet", von(W) === undefined);

    console.log("Premium wird getrackt, keine Auto-Sperre (BR6/W1):");
    pruefe("P (Premium): 3 No-Shows → Hinweis", von(P)?.anzahl === 3 && von(P)?.hinweis === true, JSON.stringify(von(P)));
    pruefe("P: Tarif = Premium ausgewiesen", von(P)?.tarif === "Premium", von(P)?.tarif);

    console.log("Sortierung:");
    const idx = (id: string) => ausw.findIndex((e) => e.mitgliedId === id);
    pruefe("absteigend nach Anzahl (X/P vor Y vor Z)", idx(X) < idx(Y) && idx(Y) < idx(Z) && idx(P) < idx(Y));

    // Schwelle-Parameter wirkt: mit schwelle=2 wird auch Y markiert.
    const ausw2 = await ladeNoShowAuswertung({ mitgliedIds: [Y], schwelle: 2 });
    pruefe("Schwelle=2 → Y markiert", ausw2.find((e) => e.mitgliedId === Y)?.hinweis === true);
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
