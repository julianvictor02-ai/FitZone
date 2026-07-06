import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kurstermin } from "@/lib/db/schema";
import { findeTrainerKollision } from "./kollision";

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

// Felder eines Vorschlags (ohne Trainer). Basis für Anlegen und Bearbeiten.
export type VorschlagFelder = Omit<VorschlagEingabe, "trainerId">;

// Prüft die Eingabefelder; liefert das erste ungültige Feld oder den normalisierten
// Stream-Link (Studio → null). Gemeinsam für Anlegen (FZ-020) und Bearbeiten (FZ-026).
function validiere(
  eingabe: VorschlagFelder,
  jetzt: Date,
): { feld: string } | { ok: true; streamLink: string | null } {
  const { kurstypId, modus, start, dauerMinuten, kapazitaet } = eingabe;
  if (!kurstypId) return { feld: "kurstyp" };
  if (modus !== "Studio" && modus !== "Livestream") return { feld: "modus" };
  if (!(start instanceof Date) || isNaN(start.getTime()) || start <= jetzt) return { feld: "start" };
  if (!Number.isInteger(dauerMinuten) || dauerMinuten <= 0) return { feld: "dauer" };
  if (!Number.isInteger(kapazitaet) || kapazitaet <= 0) return { feld: "kapazitaet" };
  // Stream-Link nur bei Livestream — dort verpflichtend, bei Studio verworfen (null).
  const streamLinkRaw = eingabe.streamLink?.trim() || null;
  if (modus === "Livestream" && !streamLinkRaw) return { feld: "streamLink" };
  return { ok: true, streamLink: modus === "Livestream" ? streamLinkRaw : null };
}

// Trainer schlägt einen Kurstermin vor. `trainerId` kommt aus der Session (die Action),
// nicht aus dem Formular — ein Trainer kann nur für sich selbst anlegen (§2b).
export async function schlageKursterminVor(
  eingabe: VorschlagEingabe,
  jetzt: Date = new Date(),
): Promise<VorschlagErgebnis> {
  const { trainerId, kurstypId, modus, start, dauerMinuten, kapazitaet } = eingabe;

  if (!trainerId) return { status: "ungueltige_eingabe", feld: "trainer" };
  const v = validiere(eingabe, jetzt);
  if ("feld" in v) return { status: "ungueltige_eingabe", feld: v.feld };

  // FZ-024 — Zeitkollision: der Trainer darf nicht zeitgleich einen weiteren, nicht
  // abgesagten Kurs haben.
  const konflikt = await findeTrainerKollision(trainerId, start, dauerMinuten);
  if (konflikt) return { status: "kollision", mitKursterminId: konflikt };

  const [kt] = await db
    .insert(kurstermin)
    .values({
      kurstypId,
      trainerId,
      modus,
      start,
      dauerMinuten,
      kapazitaet,
      streamLink: v.streamLink,
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

// FZ-026 — Ergebnis für Bearbeiten/Zurückziehen eines eigenen Vorschlags durch den Trainer.
export type EigenerVorschlagErgebnis =
  | { status: "aktualisiert" }
  | { status: "zurueckgezogen" }
  | { status: "ungueltige_eingabe"; feld: string }
  | { status: "kollision"; mitKursterminId: string }
  | { status: "nicht_gefunden" }
  | { status: "nicht_dein_vorschlag" }
  | { status: "nicht_vorgeschlagen"; von: string };

// FZ-026 — Trainer bearbeitet einen eigenen, noch nicht freigegebenen Vorschlag. Nur der
// besitzende Trainer (§2b) und nur im Status `vorgeschlagen`. Validierung + Kollision (den
// Termin selbst ausgeklammert) wie beim Anlegen.
export async function bearbeiteVorschlag(
  trainerId: string,
  kursterminId: string,
  felder: VorschlagFelder,
  jetzt: Date = new Date(),
): Promise<EigenerVorschlagErgebnis> {
  const v = validiere(felder, jetzt);
  if ("feld" in v) return { status: "ungueltige_eingabe", feld: v.feld };

  return db.transaction(async (tx) => {
    const [t] = await tx
      .select({ status: kurstermin.status, trainerId: kurstermin.trainerId })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, kursterminId))
      .for("update");
    if (!t) return { status: "nicht_gefunden" };
    if (t.trainerId !== trainerId) return { status: "nicht_dein_vorschlag" };
    if (t.status !== "vorgeschlagen") return { status: "nicht_vorgeschlagen", von: t.status };

    const konflikt = await findeTrainerKollision(
      trainerId,
      felder.start,
      felder.dauerMinuten,
      kursterminId,
    );
    if (konflikt) return { status: "kollision", mitKursterminId: konflikt };

    await tx
      .update(kurstermin)
      .set({
        kurstypId: felder.kurstypId,
        modus: felder.modus,
        start: felder.start,
        dauerMinuten: felder.dauerMinuten,
        kapazitaet: felder.kapazitaet,
        streamLink: v.streamLink,
      })
      .where(eq(kurstermin.kursterminId, kursterminId));
    return { status: "aktualisiert" };
  });
}

// FZ-026 — Trainer zieht einen eigenen Vorschlag zurück (löscht ihn). Nur der besitzende
// Trainer und nur im Status `vorgeschlagen` (nie freigegeben → keine Buchungen).
export async function zieheVorschlagZurueck(
  trainerId: string,
  kursterminId: string,
): Promise<EigenerVorschlagErgebnis> {
  return db.transaction(async (tx) => {
    const [t] = await tx
      .select({ status: kurstermin.status, trainerId: kurstermin.trainerId })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, kursterminId))
      .for("update");
    if (!t) return { status: "nicht_gefunden" };
    if (t.trainerId !== trainerId) return { status: "nicht_dein_vorschlag" };
    if (t.status !== "vorgeschlagen") return { status: "nicht_vorgeschlagen", von: t.status };

    await tx.delete(kurstermin).where(eq(kurstermin.kursterminId, kursterminId));
    return { status: "zurueckgezogen" };
  });
}
