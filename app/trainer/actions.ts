"use server";

import { revalidatePath } from "next/cache";
import { getBenutzer } from "@/lib/auth/benutzer";
import {
  erfasseAnwesenheit,
  type AnwesenheitWert,
  type AnwesenheitErgebnis,
} from "@/lib/attendance/anwesenheit";

type KeinTrainer = { status: "nicht_angemeldet" } | { status: "kein_trainer" };

export type AnwesenheitActionErgebnis = AnwesenheitErgebnis | KeinTrainer;

// FZ-004 — Anwesenheit erfassen. Trainer-Identität kommt aus der Session; die
// Kurs-Ownership-Prüfung (nur eigene Termine, §2b) erzwingt die Engine.
// Die Trainer-Oberfläche, die diese Action aufruft, folgt in FZ-005.
export async function erfasseAnwesenheitAction(
  kursterminId: string,
  mitgliedId: string,
  wert: AnwesenheitWert,
): Promise<AnwesenheitActionErgebnis> {
  const b = await getBenutzer();
  if (!b) return { status: "nicht_angemeldet" };
  if (b.rolle !== "trainer" || !b.trainerId) return { status: "kein_trainer" };

  const ergebnis = await erfasseAnwesenheit(b.trainerId, kursterminId, mitgliedId, wert);
  if (ergebnis.status === "erfasst") revalidatePath("/trainer");
  return ergebnis;
}
