import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, kurstyp, trainer, mitglied, kurstermin, buchung, wartelisteneintrag } from "../lib/db/schema";
import { bucheKurstermin } from "../lib/booking/buchung";
import { warteAufKurstermin } from "../lib/booking/warteliste";
import { storniereBuchung } from "../lib/booking/storno";

// Verifiziert FZ-007 gegen die echte DB: die Selbstansicht zeigt strikt nur eigene
// Daten (§2b) — eigene Buchungen/Historie und Wartelisten-Status mit FIFO-Position,
// keine fremden Einträge. Prüft die Queries von app/mein-bereich/page.tsx. Self-cleaning.

const AKTIV = ["wartend", "benachrichtigt"] as const;
let fehler = 0;
function pruefe(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) fehler++;
}

// Entspricht der Datenbeschaffung von app/mein-bereich/page.tsx.
async function selbstansicht(mitgliedId: string) {
  const [stamm] = await db
    .select({ name: mitglied.name, tarif: tarif.name })
    .from(mitglied)
    .innerJoin(tarif, eq(mitglied.tarifId, tarif.tarifId))
    .where(eq(mitglied.mitgliedId, mitgliedId));

  const buchungen = await db
    .select({ mitgliedId: buchung.mitgliedId, status: buchung.buchungsstatus, stornozeitpunkt: buchung.stornozeitpunkt, start: kurstermin.start })
    .from(buchung)
    .innerJoin(kurstermin, eq(buchung.kursterminId, kurstermin.kursterminId))
    .where(eq(buchung.mitgliedId, mitgliedId))
    .orderBy(desc(kurstermin.start));

  const meineWl = await db
    .select({ kursterminId: wartelisteneintrag.kursterminId, status: wartelisteneintrag.status })
    .from(wartelisteneintrag)
    .where(and(eq(wartelisteneintrag.mitgliedId, mitgliedId), inArray(wartelisteneintrag.status, [...AKTIV])))
    .orderBy(asc(wartelisteneintrag.zeitstempel));

  const wlIds = meineWl.map((w) => w.kursterminId);
  const alleAktiv = wlIds.length
    ? await db
        .select({ kursterminId: wartelisteneintrag.kursterminId, mitgliedId: wartelisteneintrag.mitgliedId })
        .from(wartelisteneintrag)
        .where(and(inArray(wartelisteneintrag.kursterminId, wlIds), inArray(wartelisteneintrag.status, [...AKTIV])))
        .orderBy(asc(wartelisteneintrag.zeitstempel))
    : [];
  const reihenfolge = new Map<string, string[]>();
  for (const e of alleAktiv) {
    const arr = reihenfolge.get(e.kursterminId) ?? [];
    arr.push(e.mitgliedId);
    reihenfolge.set(e.kursterminId, arr);
  }
  const position = (ktId: string) => (reihenfolge.get(ktId)?.indexOf(mitgliedId) ?? -1) + 1;
  return { stamm, buchungen, meineWl, position };
}

async function main() {
  const s = Date.now();
  const [tPlus] = await db.select().from(tarif).where(eq(tarif.name, "Plus"));
  const [kYoga] = await db.select().from(kurstyp).where(eq(kurstyp.name, "Yoga"));
  const [tr] = await db.insert(trainer).values({ name: `T ${s}`, email: `t-${s}@verify.test` }).returning();

  const mIds: string[] = [];
  const ktIds: string[] = [];
  async function member(tag: string): Promise<{ id: string; name: string }> {
    const [m] = await db.insert(mitglied).values({ name: tag, email: `${tag}-${s}@verify.test`, tarifId: tPlus.tarifId }).returning();
    mIds.push(m.mitgliedId);
    return { id: m.mitgliedId, name: m.name };
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
    const A = await member("Mitglied-A");
    const B = await member("Mitglied-B");
    const F = await member("Fueller");

    const kt1 = await termin(5, inStunden(48)); // A + B gebucht
    const kt2 = await termin(5, inStunden(72)); // A gebucht → storniert (Historie)
    const kt3 = await termin(1, inStunden(96)); // voll → A + B auf Warteliste

    await bucheKurstermin(A.id, kt1);
    await bucheKurstermin(B.id, kt1);
    await bucheKurstermin(A.id, kt2);
    await storniereBuchung(A.id, kt2); // A: rechtzeitig storniert
    await bucheKurstermin(F.id, kt3); // kt3 voll
    await warteAufKurstermin(A.id, kt3); // A zuerst → Position 1
    await warteAufKurstermin(B.id, kt3); // B danach → Position 2

    const a = await selbstansicht(A.id);

    console.log("Stammdaten:");
    pruefe("eigener Name + Tarif korrekt", a.stamm?.name === A.name && a.stamm?.tarif === "Plus", JSON.stringify(a.stamm));

    console.log("Eigene Buchungen / Historie (§2b):");
    pruefe("nur eigene Buchungen (alle gehören A)", a.buchungen.every((b) => b.mitgliedId === A.id));
    pruefe("genau 2 Buchungen (kt1 bestätigt + kt2 storniert), nicht Bs kt1-Buchung", a.buchungen.length === 2, `len=${a.buchungen.length}`);
    pruefe("stornierte Buchung als Historie sichtbar", a.buchungen.some((b) => b.status === "storniert" && b.stornozeitpunkt != null));
    pruefe("bestätigte Buchung sichtbar", a.buchungen.some((b) => b.status === "bestaetigt"));

    console.log("Wartelisten-Status:");
    pruefe("genau 1 aktiver Wartelisteneintrag (kt3)", a.meineWl.length === 1 && a.meineWl[0].kursterminId === kt3, JSON.stringify(a.meineWl));
    pruefe("eigene FIFO-Position = 1 (A vor B)", a.position(kt3) === 1, `pos=${a.position(kt3)}`);

    // Gegenprobe: Bs Sicht zeigt Bs Daten, Position 2 — keine Vermischung.
    const b = await selbstansicht(B.id);
    pruefe("B sieht eigene Position = 2", b.position(kt3) === 2, `pos=${b.position(kt3)}`);
    pruefe("B sieht nur eigene Buchungen", b.buchungen.every((x) => x.mitgliedId === B.id) && b.buchungen.length === 1, `len=${b.buchungen.length}`);
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
