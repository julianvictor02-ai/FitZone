"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { benutzer, mitglied } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

export type LoginErgebnis = { status: "idle" | "ok" | "fehler"; t?: number };

// Ist das zum Auth-Konto verknüpfte Mitglied per Soft-Delete auf „geloescht" gesetzt?
async function istGeloescht(authId: string): Promise<boolean> {
  const [row] = await db
    .select({ status: mitglied.status })
    .from(benutzer)
    .innerJoin(mitglied, eq(benutzer.mitgliedId, mitglied.mitgliedId))
    .where(eq(benutzer.benutzerId, authId));
  return row?.status === "geloescht";
}

// Validierung/Auth UNVERÄNDERT: identischer signInWithPassword-Aufruf. Neu ist nur, dass
// das Ergebnis als Wert zurückgegeben wird (statt server-seitig zu redirecten), damit der
// Login-Screen das Baum-Feedback zeigen kann (grün „Danke" / rot „Falsch"). Die
// Weiterleitung bei Erfolg löst der Client kurz nach der Erfolgs-Animation aus.
// `t` = Nonce, damit auch zwei gleiche Ergebnisse hintereinander die Animation neu auslösen.
export async function login(
  _prev: LoginErgebnis,
  formData: FormData,
): Promise<LoginErgebnis> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // Soft-Delete (FZ-006): gelöschte Mitglieder haben noch ein Auth-Konto, dürfen sich aber
  // nicht mehr anmelden. Anmeldung sofort wieder verwerfen und als „falsch" behandeln.
  if (!error && data.user && (await istGeloescht(data.user.id))) {
    await supabase.auth.signOut();
    return { status: "fehler", t: Date.now() };
  }

  return { status: error ? "fehler" : "ok", t: Date.now() };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
