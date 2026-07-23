import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mitglied } from "@/lib/db/schema";

// Transaktions-Typ aus db.transaction ableiten (wie in limit.ts/warteliste.ts).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Darf dieses Mitglied buchen? Nur `aktiv` — `pausiert`/`geloescht` sind gesperrt.
 * Der Status ist admin-gepflegt (SPEC §2b): Pausieren nimmt ein Mitglied bewusst vom
 * Buchungsbetrieb, ohne die Nachweis-Historie anzutasten. In der Buchungs-Transaktion
 * aufrufen, damit die Prüfung serverseitig greift (nicht nur in der UI).
 */
export async function mitgliedIstAktiv(tx: Tx, mitgliedId: string): Promise<boolean> {
  const [m] = await tx
    .select({ status: mitglied.status })
    .from(mitglied)
    .where(eq(mitglied.mitgliedId, mitgliedId));
  return m?.status === "aktiv";
}
