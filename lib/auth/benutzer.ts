import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { benutzer, mitglied } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

export type Rolle = "admin" | "trainer" | "mitglied";

export type AktuellerBenutzer = {
  benutzerId: string;
  email: string;
  rolle: Rolle;
  mitgliedId: string | null;
  trainerId: string | null;
};

// Liest das angemeldete Supabase-Konto und lädt die zugehörige benutzer-Zeile
// (Rolle + Verknüpfung). Gibt null zurück, wenn nicht angemeldet oder kein Profil.
export async function getBenutzer(): Promise<AktuellerBenutzer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [b] = await db
    .select()
    .from(benutzer)
    .where(eq(benutzer.benutzerId, user.id));
  if (!b) return null;

  // Soft-Delete (FZ-006): ein auf „geloescht" gesetztes Mitglied hat zwar noch ein Auth-Konto
  // (bleibt für die Referenzintegrität bestehen), darf aber keinen Zugriff mehr haben. Damit
  // verliert auch eine bereits laufende Sitzung sofort ihre Berechtigung.
  if (b.mitgliedId) {
    const [m] = await db
      .select({ status: mitglied.status })
      .from(mitglied)
      .where(eq(mitglied.mitgliedId, b.mitgliedId));
    if (m?.status === "geloescht") return null;
  }

  return {
    benutzerId: b.benutzerId,
    email: b.email,
    rolle: b.rolle,
    mitgliedId: b.mitgliedId,
    trainerId: b.trainerId,
  };
}

// Guard für Server Components / Server Actions: erzwingt Anmeldung und Rolle.
// Nicht angemeldet → /login, falsche Rolle → Startseite.
export async function requireRolle(
  ...erlaubt: Rolle[]
): Promise<AktuellerBenutzer> {
  const b = await getBenutzer();
  if (!b) redirect("/login");
  if (erlaubt.length > 0 && !erlaubt.includes(b.rolle)) redirect("/");
  return b;
}
