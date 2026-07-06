"use server";

import { revalidatePath } from "next/cache";
import { getBenutzer } from "@/lib/auth/benutzer";
import {
  erfasseAnwesenheit,
  type AnwesenheitWert,
  type AnwesenheitErgebnis,
} from "@/lib/attendance/anwesenheit";
import { setzeTrainerNotiz, type NotizErgebnis } from "@/lib/trainer/notiz";
import { schlageKursterminVor } from "@/lib/kurstermin/vorschlag";

type KeinTrainer = { status: "nicht_angemeldet" } | { status: "kein_trainer" };

export type AnwesenheitActionErgebnis = AnwesenheitErgebnis | KeinTrainer;
export type NotizActionErgebnis = NotizErgebnis | KeinTrainer;

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

// FZ-012 — Trainer-Notiz zu einem Teilnehmer setzen/löschen. Trainer-Identität aus der
// Session; Kurs-Ownership (§2b) erzwingt die Engine.
export async function setzeTrainerNotizAction(
  kursterminId: string,
  mitgliedId: string,
  notiz: string,
): Promise<NotizActionErgebnis> {
  const b = await getBenutzer();
  if (!b) return { status: "nicht_angemeldet" };
  if (b.rolle !== "trainer" || !b.trainerId) return { status: "kein_trainer" };

  const ergebnis = await setzeTrainerNotiz(b.trainerId, kursterminId, mitgliedId, notiz);
  if (ergebnis.status === "gespeichert") revalidatePath("/trainer");
  return ergebnis;
}

// FZ-020 — Trainer schlägt einen Kurstermin vor (Status `vorgeschlagen`). trainer_id kommt
// aus der Session (nur für sich selbst, §2b); der Admin gibt den Vorschlag anschließend frei.
export async function schlageKursVor(formData: FormData) {
  const b = await getBenutzer();
  if (!b || b.rolle !== "trainer" || !b.trainerId) return;

  const kurstypId = String(formData.get("kurstypId") ?? "");
  const modus = String(formData.get("modus") ?? "") as "Studio" | "Livestream";
  const startRaw = String(formData.get("start") ?? "").trim();
  const kapazitaetRaw = String(formData.get("kapazitaet") ?? "").trim();
  const streamLink = String(formData.get("streamLink") ?? "").trim();

  await schlageKursterminVor({
    trainerId: b.trainerId,
    kurstypId,
    modus,
    start: startRaw ? new Date(startRaw) : new Date(NaN),
    kapazitaet: Number.parseInt(kapazitaetRaw, 10),
    streamLink,
  });
  revalidatePath("/trainer");
}
