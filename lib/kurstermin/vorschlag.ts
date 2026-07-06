import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kurstermin } from "@/lib/db/schema";

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
  kapazitaet: number;
  streamLink?: string | null;
};

export type VorschlagErgebnis =
  | { status: "vorgeschlagen"; kursterminId: string }
  | { status: "ungueltige_eingabe"; feld: string };

export type FreigabeErgebnis =
  | { status: "freigegeben" }
  | { status: "abgelehnt" }
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
  if (!Number.isInteger(kapazitaet) || kapazitaet <= 0)
    return { status: "ungueltige_eingabe", feld: "kapazitaet" };

  // Stream-Link nur bei Livestream — dort verpflichtend, bei Studio verworfen.
  const streamLink = eingabe.streamLink?.trim() || null;
  if (modus === "Livestream" && !streamLink)
    return { status: "ungueltige_eingabe", feld: "streamLink" };

  const [kt] = await db
    .insert(kurstermin)
    .values({
      kurstypId,
      trainerId,
      modus,
      start,
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
      .select({ status: kurstermin.status })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, kursterminId))
      .for("update");
    if (!t) return { status: "nicht_gefunden" };
    if (t.status !== "vorgeschlagen") return { status: "nicht_vorgeschlagen", von: t.status };

    await tx
      .update(kurstermin)
      .set({ status: "geplant" })
      .where(eq(kurstermin.kursterminId, kursterminId));
    return { status: "freigegeben" };
  });
}

// Admin lehnt einen Vorschlag ab → löscht ihn. Nur im Status `vorgeschlagen` möglich; ein
// Vorschlag war nie `geplant`, hat also keine Buchungen/Warteliste — Löschen ist sicher.
export async function lehneVorschlagAb(kursterminId: string): Promise<FreigabeErgebnis> {
  return db.transaction(async (tx) => {
    const [t] = await tx
      .select({ status: kurstermin.status })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, kursterminId))
      .for("update");
    if (!t) return { status: "nicht_gefunden" };
    if (t.status !== "vorgeschlagen") return { status: "nicht_vorgeschlagen", von: t.status };

    await tx.delete(kurstermin).where(eq(kurstermin.kursterminId, kursterminId));
    return { status: "abgelehnt" };
  });
}
