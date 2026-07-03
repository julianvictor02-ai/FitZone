import { and, eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { tarif, kurstyp, trainer, mitglied, kurstermin, buchung, wartelisteneintrag } from "../lib/db/schema";
import { bucheKurstermin } from "../lib/booking/buchung";
import {
  warteAufKurstermin,
  verarbeiteWarteliste,
  bestaetigeNachrueckung,
  MAX_WARTELISTE,
} from "../lib/booking/warteliste";

// Verifiziert FZ-002 (BR2/BR3) gegen die echte DB. Legt temporäre Testdaten an,
// prüft FIFO-Nachrücken, 30-Min-Ablauf, Obergrenze und Bestätigung, räumt auf.

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
    .values({ name: `WL ${s}`, email: `wl-tr-${s}@verify.test` })
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
  async function termin(kap: number): Promise<string> {
    const [kt] = await db
      .insert(kurstermin)
      .values({
        kurstypId: kYoga.kurstypId,
        trainerId: tr.trainerId,
        modus: "Studio",
        start: new Date(Date.now() + 86_400_000),
        kapazitaet: kap,
        status: "geplant",
      })
      .returning();
    ktIds.push(kt.kursterminId);
    return kt.kursterminId;
  }
  async function wlStatus(m: string, kt: string) {
    const [e] = await db
      .select({ status: wartelisteneintrag.status })
      .from(wartelisteneintrag)
      .where(and(eq(wartelisteneintrag.mitgliedId, m), eq(wartelisteneintrag.kursterminId, kt)));
    return e?.status;
  }
  async function storniere(m: string, kt: string) {
    await db
      .update(buchung)
      .set({ buchungsstatus: "storniert", stornozeitpunkt: new Date() })
      .where(
        and(
          eq(buchung.mitgliedId, m),
          eq(buchung.kursterminId, kt),
          eq(buchung.buchungsstatus, "bestaetigt"),
        ),
      );
  }

  try {
    // --- Szenario A: FIFO-Nachrücken + Bestätigung ---
    console.log("Szenario A — FIFO-Nachrücken & Bestätigung:");
    const A = await member("A"), B = await member("B"), C = await member("C");
    const kt1 = await termin(1);

    await bucheKurstermin(A, kt1); // voll
    const wB = await warteAufKurstermin(B, kt1);
    const wC = await warteAufKurstermin(C, kt1);
    pruefe("B tritt Warteliste bei → Position 1", wB.status === "wartend" && wB.position === 1);
    pruefe("C tritt Warteliste bei → Position 2", wC.status === "wartend" && wC.position === 2);

    const p0 = await verarbeiteWarteliste(kt1);
    pruefe("kein freier Platz → niemand rückt nach", p0 === 0, `promoted=${p0}`);

    await storniere(A, kt1); // Platz frei
    const p1 = await verarbeiteWarteliste(kt1);
    pruefe("Platz frei → genau 1 rückt nach (FIFO)", p1 === 1, `promoted=${p1}`);
    pruefe("ältester (B) wird benachrichtigt", (await wlStatus(B, kt1)) === "benachrichtigt");
    pruefe("C bleibt wartend (kein Vordrängeln)", (await wlStatus(C, kt1)) === "wartend");

    const cFalsch = await bestaetigeNachrueckung(C, kt1);
    pruefe("C ohne Angebot kann nicht bestätigen", cFalsch.status === "kein_angebot", cFalsch.status);
    const bOk = await bestaetigeNachrueckung(B, kt1);
    pruefe("B bestätigt Nachrücken → gebucht", bOk.status === "nachgerueckt", bOk.status);
    pruefe("B ist jetzt nachgerueckt", (await wlStatus(B, kt1)) === "nachgerueckt");

    // --- Szenario B: 30-Min-Ablauf → automatisches Weiterrücken ---
    console.log("Szenario B — Frist-Ablauf & Auto-Advance:");
    const X = await member("X"), D = await member("D"), E = await member("E");
    const kt2 = await termin(1);
    await bucheKurstermin(X, kt2);
    await warteAufKurstermin(D, kt2);
    await warteAufKurstermin(E, kt2);
    await storniere(X, kt2);
    await verarbeiteWarteliste(kt2); // D benachrichtigt
    pruefe("D wird benachrichtigt", (await wlStatus(D, kt2)) === "benachrichtigt");

    // Frist künstlich in die Vergangenheit setzen
    await db
      .update(wartelisteneintrag)
      .set({ fristBis: new Date(Date.now() - 60_000) })
      .where(and(eq(wartelisteneintrag.mitgliedId, D), eq(wartelisteneintrag.kursterminId, kt2)));
    await verarbeiteWarteliste(kt2);
    pruefe("D verfällt nach Fristablauf", (await wlStatus(D, kt2)) === "abgelaufen");
    pruefe("E rückt automatisch nach", (await wlStatus(E, kt2)) === "benachrichtigt");
    const dSpaet = await bestaetigeNachrueckung(D, kt2);
    pruefe("D kann nach Ablauf nicht mehr bestätigen", dSpaet.status === "kein_angebot", dSpaet.status);

    // --- Szenario C: harte Obergrenze (BR3) ---
    console.log(`Szenario C — harte Obergrenze (${MAX_WARTELISTE}):`);
    const P = await member("P");
    const kt3 = await termin(1);
    await bucheKurstermin(P, kt3);
    let alleWartend = true;
    for (let i = 0; i < MAX_WARTELISTE; i++) {
      const r = await warteAufKurstermin(await member(`cap${i}`), kt3);
      if (r.status !== "wartend") alleWartend = false;
    }
    pruefe(`${MAX_WARTELISTE} Einträge werden angenommen`, alleWartend);
    const ueber = await warteAufKurstermin(await member("ueber"), kt3);
    pruefe("Eintrag über der Obergrenze wird abgelehnt", ueber.status === "warteliste_voll", ueber.status);

    // --- Nicht voll → platz_frei statt Warteliste ---
    const Q = await member("Q");
    const kt4 = await termin(2);
    const qr = await warteAufKurstermin(Q, kt4);
    pruefe("nicht voller Kurs → platz_frei (regulär buchen)", qr.status === "platz_frei", qr.status);
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
