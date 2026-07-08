import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { buchung, kurstermin, kurstyp, mitglied } from "@/lib/db/schema";

// Admin-Entscheidung über fällige Stornogebühren (BR5, Ergänzung zu FZ-016). Die Gebühr
// wird beim Storno automatisch als Flag/Betrag markiert; der Admin entscheidet pro Fall,
// ob sie erlassen oder bestätigt wird. Abbuchung bleibt manuell außerhalb (kein Payment v1).

export type Entscheidung = "erlassen" | "bestaetigt";

export type OffeneStornoGebuehr = {
  buchungId: string;
  mitgliedName: string;
  kurstyp: string;
  kursStart: Date;
  stornozeitpunkt: Date | null;
  betrag: number | null;
};

/** Offene Fälle: Gebühr ist fällig und der Admin hat noch nicht entschieden. */
export async function ladeOffeneStornoGebuehren(): Promise<OffeneStornoGebuehr[]> {
  const rows = await db
    .select({
      buchungId: buchung.buchungId,
      mitgliedName: mitglied.name,
      kurstyp: kurstyp.name,
      kursStart: kurstermin.start,
      stornozeitpunkt: buchung.stornozeitpunkt,
      betrag: buchung.stornoGebuehrBetrag,
    })
    .from(buchung)
    .innerJoin(mitglied, eq(buchung.mitgliedId, mitglied.mitgliedId))
    .innerJoin(kurstermin, eq(buchung.kursterminId, kurstermin.kursterminId))
    .innerJoin(kurstyp, eq(kurstermin.kurstypId, kurstyp.kurstypId))
    .where(
      and(
        eq(buchung.stornoGebuehrFaellig, true),
        isNull(buchung.stornoGebuehrEntscheidung),
      ),
    )
    .orderBy(desc(buchung.stornozeitpunkt));

  return rows.map((r) => ({ ...r, betrag: r.betrag != null ? Number(r.betrag) : null }));
}

/**
 * Setzt die Admin-Entscheidung auf einer Buchung mit fälliger Gebühr. Idempotent und auf
 * fällige Fälle beschränkt (kein Setzen bei nicht-fälliger Gebühr).
 */
export async function entscheideStornoGebuehr(
  buchungId: string,
  entscheidung: Entscheidung,
): Promise<void> {
  await db
    .update(buchung)
    .set({ stornoGebuehrEntscheidung: entscheidung })
    .where(and(eq(buchung.buchungId, buchungId), eq(buchung.stornoGebuehrFaellig, true)));
}
