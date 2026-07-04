"use server";

import { getBenutzer } from "@/lib/auth/benutzer";
import { speicherePushAbo, entfernePushAbo, type PushAboEingang } from "@/lib/push/abo";

// FZ-019 — Push-Abo eines Mitglieds an-/abmelden. Mitglied kommt aus der Session;
// gespeichert wird nur für das eigene Konto (§2b).

type Ergebnis = { status: "ok" } | { status: "kein_mitglied" };

export async function aktivierePushAction(sub: PushAboEingang): Promise<Ergebnis> {
  const b = await getBenutzer();
  if (!b || b.rolle !== "mitglied" || !b.mitgliedId) return { status: "kein_mitglied" };
  await speicherePushAbo(b.mitgliedId, sub);
  return { status: "ok" };
}

export async function deaktivierePushAction(endpoint: string): Promise<Ergebnis> {
  const b = await getBenutzer();
  if (!b || b.rolle !== "mitglied" || !b.mitgliedId) return { status: "kein_mitglied" };
  await entfernePushAbo(b.mitgliedId, endpoint);
  return { status: "ok" };
}
