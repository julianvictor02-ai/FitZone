"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { aktiviereKonto } from "@/lib/auth/aktivierung";

export type AktivierenState = {
  status: "idle" | "ungueltig" | "passwort_schwach" | "passwort_ungleich";
  t?: number;
};

// Aktiviert das Konto und loggt bei Erfolg direkt ein (Cookies), dann → Startseite.
// Bei Fehler wird der Status als Wert zurückgegeben (Formular zeigt neutrale Meldung).
export async function aktiviereKontoAction(
  _prev: AktivierenState,
  formData: FormData,
): Promise<AktivierenState> {
  const email = String(formData.get("email") ?? "");
  const passwort = String(formData.get("passwort") ?? "");
  const passwortBestaetigung = String(formData.get("passwortBestaetigung") ?? "");

  const r = await aktiviereKonto(email, passwort, passwortBestaetigung);
  if (r.status !== "ok") return { status: r.status, t: Date.now() };

  // Auto-Login: Session-Cookies setzen.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: passwort,
  });

  // Konto ist angelegt; klemmt nur der Auto-Login → zum Login mit Erfolgshinweis.
  redirect(error ? "/login?aktiviert=1" : "/");
}
