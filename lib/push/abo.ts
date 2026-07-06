import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushAbo } from "@/lib/db/schema";

// FZ-019 — Verwaltung der Web-Push-Abos (Speichern/Laden/Löschen). Bewusst ohne
// `web-push`-Import, damit die reine DB-Schicht unabhängig testbar bleibt.

export type PushAboEingang = { endpoint: string; p256dh: string; auth: string };

export type PushAbo = {
  aboId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Legt ein Push-Abo an oder aktualisiert es (Upsert über den eindeutigen `endpoint`).
 * Meldet sich dasselbe Gerät erneut an, werden Keys/Mitglied aktualisiert statt dupliziert.
 */
export async function speicherePushAbo(mitgliedId: string, sub: PushAboEingang): Promise<void> {
  await db
    .insert(pushAbo)
    .values({ mitgliedId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })
    .onConflictDoUpdate({
      target: pushAbo.endpoint,
      set: { mitgliedId, p256dh: sub.p256dh, auth: sub.auth },
    });
}

/** Entfernt ein Abo (nur eigenes: endpoint + mitglied_id). */
export async function entfernePushAbo(mitgliedId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushAbo)
    .where(and(eq(pushAbo.endpoint, endpoint), eq(pushAbo.mitgliedId, mitgliedId)));
}

/** Alle Abos eines Mitglieds (Versandziele). */
export async function ladePushAbos(mitgliedId: string): Promise<PushAbo[]> {
  return db
    .select({
      aboId: pushAbo.aboId,
      endpoint: pushAbo.endpoint,
      p256dh: pushAbo.p256dh,
      auth: pushAbo.auth,
    })
    .from(pushAbo)
    .where(eq(pushAbo.mitgliedId, mitgliedId));
}

/** Löscht ein Abo per ID — für abgelaufene Endpunkte (Push-Service meldet 404/410). */
export async function loeschePushAbo(aboId: string): Promise<void> {
  await db.delete(pushAbo).where(eq(pushAbo.aboId, aboId));
}

// FZ-022 — dieselbe Abo-Mechanik für Trainer (push_abo trägt entweder mitglied_id ODER
// trainer_id). Spiegelt die Mitglieds-Funktionen; kein `web-push`-Import (headless testbar).

/** Legt ein Trainer-Push-Abo an oder aktualisiert es (Upsert über `endpoint`). */
export async function speicherePushAboTrainer(trainerId: string, sub: PushAboEingang): Promise<void> {
  await db
    .insert(pushAbo)
    .values({ trainerId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })
    .onConflictDoUpdate({
      target: pushAbo.endpoint,
      set: { trainerId, mitgliedId: null, p256dh: sub.p256dh, auth: sub.auth },
    });
}

/** Entfernt ein Trainer-Abo (nur eigenes: endpoint + trainer_id). */
export async function entfernePushAboTrainer(trainerId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushAbo)
    .where(and(eq(pushAbo.endpoint, endpoint), eq(pushAbo.trainerId, trainerId)));
}

/** Alle Abos eines Trainers (Versandziele). */
export async function ladePushAbosTrainer(trainerId: string): Promise<PushAbo[]> {
  return db
    .select({
      aboId: pushAbo.aboId,
      endpoint: pushAbo.endpoint,
      p256dh: pushAbo.p256dh,
      auth: pushAbo.auth,
    })
    .from(pushAbo)
    .where(eq(pushAbo.trainerId, trainerId));
}
