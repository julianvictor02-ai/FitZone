"use server";

import { revalidatePath } from "next/cache";
import { getBenutzer } from "@/lib/auth/benutzer";
import { bucheKurstermin, type BuchungErgebnis } from "@/lib/booking/buchung";
import {
  warteAufKurstermin,
  bestaetigeNachrueckung,
  type WarteErgebnis,
  type NachrueckErgebnis,
} from "@/lib/booking/warteliste";

type NichtMitglied = { status: "nicht_angemeldet" } | { status: "kein_mitglied" };

export type BuchungActionErgebnis = BuchungErgebnis | NichtMitglied;
export type WarteActionErgebnis = WarteErgebnis | NichtMitglied;
export type NachrueckActionErgebnis = NachrueckErgebnis | NichtMitglied;

async function mitgliedId(): Promise<string | NichtMitglied> {
  const b = await getBenutzer();
  if (!b) return { status: "nicht_angemeldet" };
  if (!b.mitgliedId) return { status: "kein_mitglied" };
  return b.mitgliedId;
}

// FZ-001 — Kursbuchung mit Auto-Bestätigung.
export async function bucheKursterminAction(
  kursterminId: string,
): Promise<BuchungActionErgebnis> {
  const id = await mitgliedId();
  if (typeof id !== "string") return id;

  const ergebnis = await bucheKurstermin(id, kursterminId);
  if (ergebnis.status === "bestaetigt") revalidatePath("/kurse");
  return ergebnis;
}

// FZ-002 — Warteliste beitreten (bei vollem Kurs).
export async function warteAction(
  kursterminId: string,
): Promise<WarteActionErgebnis> {
  const id = await mitgliedId();
  if (typeof id !== "string") return id;

  const ergebnis = await warteAufKurstermin(id, kursterminId);
  if (ergebnis.status === "wartend") revalidatePath("/kurse");
  return ergebnis;
}

// FZ-002 — Nachrück-Angebot bestätigen (innerhalb der 30-Min-Frist).
export async function bestaetigeNachrueckungAction(
  kursterminId: string,
): Promise<NachrueckActionErgebnis> {
  const id = await mitgliedId();
  if (typeof id !== "string") return id;

  const ergebnis = await bestaetigeNachrueckung(id, kursterminId);
  if (ergebnis.status === "nachgerueckt" || ergebnis.status === "abgelaufen") {
    revalidatePath("/kurse");
  }
  return ergebnis;
}
