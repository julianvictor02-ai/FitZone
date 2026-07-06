"use server";

import { revalidatePath } from "next/cache";
import { getBenutzer } from "@/lib/auth/benutzer";
import {
  erfasseAnwesenheit,
  type AnwesenheitWert,
  type AnwesenheitErgebnis,
} from "@/lib/attendance/anwesenheit";
import { setzeTrainerNotiz, type NotizErgebnis } from "@/lib/trainer/notiz";
import {
  schlageKursterminVor,
  bearbeiteVorschlag,
  zieheVorschlagZurueck,
} from "@/lib/kurstermin/vorschlag";
import {
  speicherePushAboTrainer,
  entfernePushAboTrainer,
  type PushAboEingang,
} from "@/lib/push/abo";

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
  const dauerRaw = String(formData.get("dauerMinuten") ?? "").trim();
  const kapazitaetRaw = String(formData.get("kapazitaet") ?? "").trim();
  const streamLink = String(formData.get("streamLink") ?? "").trim();

  await schlageKursterminVor({
    trainerId: b.trainerId,
    kurstypId,
    modus,
    start: startRaw ? new Date(startRaw) : new Date(NaN),
    dauerMinuten: Number.parseInt(dauerRaw, 10),
    kapazitaet: Number.parseInt(kapazitaetRaw, 10),
    streamLink,
  });
  revalidatePath("/trainer");
}

// FZ-026 — Trainer bearbeitet einen eigenen, noch nicht freigegebenen Vorschlag.
export async function bearbeiteVorschlagAction(formData: FormData) {
  const b = await getBenutzer();
  if (!b || b.rolle !== "trainer" || !b.trainerId) return;

  const kursterminId = String(formData.get("kursterminId") ?? "");
  if (!kursterminId) return;
  const modus = String(formData.get("modus") ?? "") as "Studio" | "Livestream";
  const startRaw = String(formData.get("start") ?? "").trim();

  await bearbeiteVorschlag(b.trainerId, kursterminId, {
    kurstypId: String(formData.get("kurstypId") ?? ""),
    modus,
    start: startRaw ? new Date(startRaw) : new Date(NaN),
    dauerMinuten: Number.parseInt(String(formData.get("dauerMinuten") ?? ""), 10),
    kapazitaet: Number.parseInt(String(formData.get("kapazitaet") ?? ""), 10),
    streamLink: String(formData.get("streamLink") ?? "").trim(),
  });
  revalidatePath("/trainer");
}

// FZ-026 — Trainer zieht einen eigenen Vorschlag zurück (löscht ihn).
export async function zieheVorschlagZurueckAction(formData: FormData) {
  const b = await getBenutzer();
  if (!b || b.rolle !== "trainer" || !b.trainerId) return;

  const kursterminId = String(formData.get("kursterminId") ?? "");
  if (!kursterminId) return;

  await zieheVorschlagZurueck(b.trainerId, kursterminId);
  revalidatePath("/trainer");
}

// FZ-022 — Push-Abo eines Trainers an-/abmelden. Trainer kommt aus der Session; gespeichert
// wird nur für das eigene Konto (§2b).
type PushErgebnis = { status: "ok" } | { status: "kein_trainer" };

export async function aktivierePushTrainerAction(sub: PushAboEingang): Promise<PushErgebnis> {
  const b = await getBenutzer();
  if (!b || b.rolle !== "trainer" || !b.trainerId) return { status: "kein_trainer" };
  await speicherePushAboTrainer(b.trainerId, sub);
  return { status: "ok" };
}

export async function deaktivierePushTrainerAction(endpoint: string): Promise<PushErgebnis> {
  const b = await getBenutzer();
  if (!b || b.rolle !== "trainer" || !b.trainerId) return { status: "kein_trainer" };
  await entfernePushAboTrainer(b.trainerId, endpoint);
  return { status: "ok" };
}
