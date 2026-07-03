"use server";

import { revalidatePath } from "next/cache";
import { getBenutzer } from "@/lib/auth/benutzer";
import { bucheKurstermin, type BuchungErgebnis } from "@/lib/booking/buchung";

export type BuchungActionErgebnis =
  | BuchungErgebnis
  | { status: "nicht_angemeldet" }
  | { status: "kein_mitglied" };

// Server Action für FZ-001: ermittelt das angemeldete Mitglied über die
// Auth-/Rollen-Schicht (FZ-006) und ruft die atomare Buchungslogik.
export async function bucheKursterminAction(
  kursterminId: string,
): Promise<BuchungActionErgebnis> {
  const b = await getBenutzer();
  if (!b) return { status: "nicht_angemeldet" };
  if (!b.mitgliedId) return { status: "kein_mitglied" };

  const ergebnis = await bucheKurstermin(b.mitgliedId, kursterminId);
  if (ergebnis.status === "bestaetigt") revalidatePath("/kurse");
  return ergebnis;
}
