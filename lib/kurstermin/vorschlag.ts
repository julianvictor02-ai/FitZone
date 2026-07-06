import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { kurstermin } from "@/lib/db/schema";

// FZ-024 — Fallback-Dauer für die Kollisionsprüfung, wenn ein bestehender Termin (z. B.
// Seed-Daten) noch keine Dauer trägt. Verhindert, dass ein Termin ohne Dauer „unsichtbar"
// für die Überlappung wird.
const FALLBACK_DAUER_MINUTEN = 60;

// FZ-020 — Kurstermin-Vorschlag: der Trainer legt einen Kurs an (Status `vorgeschlagen`),
// der Admin gibt ihn frei (→ `geplant`) oder lehnt ihn ab (löscht den Vorschlag). Erst nach
// Freigabe erscheint der Termin für Mitglieder in /kurse und ist buchbar — beide Pfade
// filtern strikt auf `status = "geplant"` (FZ-001 / app/kurse), ein weiterer Guard entfällt.
// So liegt die Erfassungsarbeit beim Trainer; der Admin bestätigt nur.

export type Modus = "Studio" | "Livestream";

export type VorschlagEingabe = {
  trainerId: string;
  kurstypId: string;
  modus: Modus;
  start: Date;
  dauerMinuten: number;
  kapazitaet: number;
  streamLink?: string | null;
};

export type VorschlagErgebnis =
  | { status: "vorgeschlagen"; kursterminId: string }
  | { status: "ungueltige_eingabe"; feld: string }
  | { status: "kollision"; mitKursterminId: string }; // Trainer hat zeitgleich schon einen Kurs

export type FreigabeErgebnis =
  | { status: "freigegeben"; trainerId: string }
  | { status: "abgelehnt"; trainerId: string }
  | { status: "nicht_gefunden" }
  | { status: "nicht_vorgeschlagen"; von: string };

// Trainer schlägt einen Kurstermin vor. `trainerId` kommt aus der Session (die Action),
// nicht aus dem Formular — ein Trainer kann nur für sich selbst anlegen (§2b).
export async function schlageKursterminVor(
  eingabe: VorschlagEingabe,
  jetzt: Date = new Date(),
): Promise<VorschlagErgebnis> {
  const { trainerId, kurstypId, modus, start, kapazitaet } = eingabe;

  if (!trainerId) return { status: "ungueltige_eingabe", feld: "trainer" };
  if (!kurstypId) return { status: "ungueltige_eingabe", feld: "kurstyp" };
  if (modus !== "Studio" && modus !== "Livestream")
    return { status: "ungueltige_eingabe", feld: "modus" };
  if (!(start instanceof Date) || isNaN(start.getTime()) || start <= jetzt)
    return { status: "ungueltige_eingabe", feld: "start" };
  const { dauerMinuten } = eingabe;
  if (!Number.isInteger(dauerMinuten) || dauerMinuten <= 0)
    return { status: "ungueltige_eingabe", feld: "dauer" };
  if (!Number.isInteger(kapazitaet) || kapazitaet <= 0)
    return { status: "ungueltige_eingabe", feld: "kapazitaet" };

  // Stream-Link nur bei Livestream — dort verpflichtend, bei Studio verworfen.
  const streamLink = eingabe.streamLink?.trim() || null;
  if (modus === "Livestream" && !streamLink)
    return { status: "ungueltige_eingabe", feld: "streamLink" };

  // FZ-024 — Zeitkollision: der Trainer darf nicht zeitgleich einen weiteren (nicht
  // abgesagten) Kurs haben. Überlappung [start, ende) — Fallback-Dauer für Alt-Termine
  // ohne Dauer. Einzelnutzer-Aktion → ungelockt (analog Monatslimit FZ-010).
  const ende = (s: Date, d: number | null) =>
    new Date(s.getTime() + (d ?? FALLBACK_DAUER_MINUTEN) * 60_000);
  const neuEnde = ende(start, dauerMinuten);
  const bestehende = await db
    .select({ id: kurstermin.kursterminId, start: kurstermin.start, dauer: kurstermin.dauerMinuten })
    .from(kurstermin)
    .where(and(eq(kurstermin.trainerId, trainerId), ne(kurstermin.status, "abgesagt")));
  const konflikt = bestehende.find((e) => start < ende(e.start, e.dauer) && e.start < neuEnde);
  if (konflikt) return { status: "kollision", mitKursterminId: konflikt.id };

  const [kt] = await db
    .insert(kurstermin)
    .values({
      kurstypId,
      trainerId,
      modus,
      start,
      dauerMinuten,
      kapazitaet,
      streamLink: modus === "Livestream" ? streamLink : null,
      status: "vorgeschlagen",
    })
    .returning({ kursterminId: kurstermin.kursterminId });

  return { status: "vorgeschlagen", kursterminId: kt.kursterminId };
}

// Admin-Freigabe: nur `vorgeschlagen → geplant`. Atomar (FOR UPDATE), damit eine doppelte
// Freigabe (Doppelklick / zwei Admins) nicht zweimal wirkt.
export async function gibKursterminFrei(kursterminId: string): Promise<FreigabeErgebnis> {
  return db.transaction(async (tx) => {
    const [t] = await tx
      .select({ status: kurstermin.status, trainerId: kurstermin.trainerId })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, kursterminId))
      .for("update");
    if (!t) return { status: "nicht_gefunden" };
    if (t.status !== "vorgeschlagen") return { status: "nicht_vorgeschlagen", von: t.status };

    await tx
      .update(kurstermin)
      .set({ status: "geplant" })
      .where(eq(kurstermin.kursterminId, kursterminId));
    return { status: "freigegeben", trainerId: t.trainerId };
  });
}

// Admin lehnt einen Vorschlag ab → löscht ihn. Nur im Status `vorgeschlagen` möglich; ein
// Vorschlag war nie `geplant`, hat also keine Buchungen/Warteliste — Löschen ist sicher.
export async function lehneVorschlagAb(kursterminId: string): Promise<FreigabeErgebnis> {
  return db.transaction(async (tx) => {
    const [t] = await tx
      .select({ status: kurstermin.status, trainerId: kurstermin.trainerId })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, kursterminId))
      .for("update");
    if (!t) return { status: "nicht_gefunden" };
    if (t.status !== "vorgeschlagen") return { status: "nicht_vorgeschlagen", von: t.status };

    await tx.delete(kurstermin).where(eq(kurstermin.kursterminId, kursterminId));
    return { status: "abgelehnt", trainerId: t.trainerId };
  });
}
