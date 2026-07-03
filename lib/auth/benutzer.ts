import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { benutzer } from "@/lib/db/schema";
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
