import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { kurstermin } from "@/lib/db/schema";

// FZ-024/FZ-025 — gemeinsame Trainer-Zeitkollisionsprüfung, genutzt beim Vorschlagen
// (schlageKursterminVor/bearbeiteVorschlag) und beim Admin-Verschieben (FZ-009).

// Fallback-Dauer, wenn ein bestehender Termin (z. B. Seed) noch keine Dauer trägt —
// verhindert, dass er „unsichtbar" für die Überlappung wird.
export const FALLBACK_DAUER_MINUTEN = 60;

export function ende(start: Date, dauerMinuten: number | null): Date {
  return new Date(start.getTime() + (dauerMinuten ?? FALLBACK_DAUER_MINUTEN) * 60_000);
}

/**
 * Liefert die ID eines zeitlich überlappenden, nicht abgesagten Termins **desselben
 * Trainers** (oder null). Überlappung `[start, ende)`; angrenzend (Ende == Start) zählt
 * nicht. `ausschlussId` klammert den geprüften Termin selbst aus (Bearbeiten/Verschieben).
 * Ungelockt (Einzelnutzer-Aktion, analog FZ-010).
 */
export async function findeTrainerKollision(
  trainerId: string,
  start: Date,
  dauerMinuten: number | null,
  ausschlussId?: string,
): Promise<string | null> {
  const neuEnde = ende(start, dauerMinuten);
  const bestehende = await db
    .select({ id: kurstermin.kursterminId, start: kurstermin.start, dauer: kurstermin.dauerMinuten })
    .from(kurstermin)
    .where(and(eq(kurstermin.trainerId, trainerId), ne(kurstermin.status, "abgesagt")));
  const konflikt = bestehende.find(
    (e) => e.id !== ausschlussId && start < ende(e.start, e.dauer) && e.start < neuEnde,
  );
  return konflikt?.id ?? null;
}
