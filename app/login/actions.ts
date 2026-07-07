"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginErgebnis = { status: "idle" | "ok" | "fehler"; t?: number };

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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  return { status: error ? "fehler" : "ok", t: Date.now() };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
