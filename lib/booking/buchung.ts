import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { buchung, kurstermin } from "@/lib/db/schema";
import { pruefeMonatslimit } from "@/lib/booking/limit";

// FZ-001 — Kursbuchung mit Auto-Bestätigung (Business Rule BR1).
// Konzept: docs/concepts/FZ-001-kursbuchung.md

export type BuchungErgebnis =
  | { status: "bestaetigt"; buchungId: string; buchungszeitpunkt: Date }
  | { status: "voll" } //           Kurs ausgebucht → Warteliste anbieten (FZ-002)
  | { status: "bereits_gebucht" } // aktive Buchung existiert bereits
  | { status: "limit_erreicht"; limit: number } // Monatslimit des Tarifs erreicht (BR4)
  | { status: "kurs_nicht_buchbar" }; // Termin fehlt / abgesagt / verschoben

/**
 * Bucht ein Mitglied auf einen Kurstermin und bestätigt automatisch, sofern ein
 * Platz frei ist (BR1). Die Kapazitätsprüfung läuft server-seitig und **atomar**:
 * Der Kurstermin wird per SELECT ... FOR UPDATE gesperrt, wodurch konkurrierende
 * Buchungen desselben Termins serialisiert werden — der letzte Platz kann nicht
 * doppelt vergeben werden. Der partielle Unique-Index ist zusätzlicher Backstop.
 */
export async function bucheKurstermin(
  mitgliedId: string,
  kursterminId: string,
): Promise<BuchungErgebnis> {
  return db.transaction(async (tx) => {
    // 1. Kurstermin-Zeile sperren → serialisiert alle Buchungen dieses Termins.
    const [termin] = await tx
      .select({
        kapazitaet: kurstermin.kapazitaet,
        status: kurstermin.status,
        start: kurstermin.start,
      })
      .from(kurstermin)
      .where(eq(kurstermin.kursterminId, kursterminId))
      .for("update");

    if (!termin || termin.status !== "geplant") {
      return { status: "kurs_nicht_buchbar" };
    }

    // 2. Doppelbuchung verhindern (bereits aktive Buchung dieses Mitglieds).
    const [vorhanden] = await tx
      .select({ id: buchung.buchungId })
      .from(buchung)
      .where(
        and(
          eq(buchung.mitgliedId, mitgliedId),
          eq(buchung.kursterminId, kursterminId),
          eq(buchung.buchungsstatus, "bestaetigt"),
        ),
      );
    if (vorhanden) return { status: "bereits_gebucht" };

    // 3. Belegung zählen (nur bestätigte Buchungen).
    const [belegung] = await tx
      .select({ anzahl: sql<number>`count(*)::int` })
      .from(buchung)
      .where(
        and(
          eq(buchung.kursterminId, kursterminId),
          eq(buchung.buchungsstatus, "bestaetigt"),
        ),
      );

    if (belegung.anzahl >= termin.kapazitaet) return { status: "voll" };

    // 4. Buchungslimit des Tarifs (BR4) — erst prüfen, wenn wirklich gebucht würde
    //    (bei vollem Kurs greift oben "voll"/Warteliste, das ist keine Buchung).
    const limit = await pruefeMonatslimit(tx, mitgliedId, termin.start);
    if (!limit.erlaubt) return { status: "limit_erreicht", limit: limit.limit };

    // 5. Auto-Bestätigung + Nachweis-Zeitstempel (BR1 / NFR, defaultNow()).
    const [neu] = await tx
      .insert(buchung)
      .values({ mitgliedId, kursterminId, buchungsstatus: "bestaetigt" })
      .returning({
        id: buchung.buchungId,
        ts: buchung.buchungszeitpunkt,
      });

    return {
      status: "bestaetigt",
      buchungId: neu.id,
      buchungszeitpunkt: neu.ts,
    };
  });
}
