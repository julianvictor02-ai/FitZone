"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mitglied } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { bucheKurstermin, type BuchungErgebnis } from "@/lib/booking/buchung";

export type BuchungActionErgebnis =
  | BuchungErgebnis
  | { status: "nicht_angemeldet" }
  | { status: "kein_mitglied" };

// Server Action für FZ-001: leitet das angemeldete Supabase-Konto auf das
// Mitglied ab und ruft die Buchungslogik. Nahtstelle zwischen Auth und Domäne.
// (Login/Mitglieder-Seeding folgt mit FZ-006; bis dahin nicht produktiv nutzbar.)
export async function bucheKursterminAction(
  kursterminId: string,
): Promise<BuchungActionErgebnis> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { status: "nicht_angemeldet" };

  const [m] = await db
    .select({ id: mitglied.mitgliedId })
    .from(mitglied)
    .where(eq(mitglied.email, user.email));

  if (!m) return { status: "kein_mitglied" };

  return bucheKurstermin(m.id, kursterminId);
}
