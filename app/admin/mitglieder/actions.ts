"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { mitglied } from "@/lib/db/schema";
import { requireRolle } from "@/lib/auth/benutzer";

// FZ-006 — Mitgliederstammdaten, admin-gepflegt. Nur Admin.

export type MitgliedErgebnis =
  | { status: "ok" }
  | { status: "fehler"; meldung: string };

export async function erstelleMitglied(formData: FormData) {
  await requireRolle("admin");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const tarifId = String(formData.get("tarifId") ?? "");
  const mitgliedschaftBis = String(formData.get("mitgliedschaftBis") ?? "").trim();

  if (!name || !email || !tarifId) return;

  await db.insert(mitglied).values({
    name,
    email,
    tarifId,
    mitgliedschaftBis: mitgliedschaftBis || null,
  });

  revalidatePath("/admin/mitglieder");
}

// Bearbeiten aus der Leseansicht: übernimmt Name, Tarif, Status und Mitgliedschaft-bis.
// Validierung wie beim Anlegen (Pflichtfelder, gültiges Datum). Rückgabewert steuert das
// Erfolgs-/Fehler-Feedback (Toast) im Client. „geloescht" wird hier bewusst NICHT gesetzt —
// dafür gibt es den separaten Soft-Delete-Flow.
export async function aktualisiereMitglied(formData: FormData): Promise<MitgliedErgebnis> {
  await requireRolle("admin");

  const mitgliedId = String(formData.get("mitgliedId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const tarifId = String(formData.get("tarifId") ?? "");
  const status = String(formData.get("status") ?? "");
  const mitgliedschaftBis = String(formData.get("mitgliedschaftBis") ?? "").trim();

  if (!mitgliedId) return { status: "fehler", meldung: "Mitglied nicht gefunden." };
  if (!name) return { status: "fehler", meldung: "Name ist ein Pflichtfeld." };
  if (!tarifId) return { status: "fehler", meldung: "Tarif ist ein Pflichtfeld." };
  if (status !== "aktiv" && status !== "pausiert") {
    return { status: "fehler", meldung: "Ungültiger Status." };
  }
  if (mitgliedschaftBis && !/^\d{4}-\d{2}-\d{2}$/.test(mitgliedschaftBis)) {
    return { status: "fehler", meldung: "Ungültiges Datum." };
  }

  await db
    .update(mitglied)
    .set({ name, tarifId, status, mitgliedschaftBis: mitgliedschaftBis || null })
    .where(eq(mitglied.mitgliedId, mitgliedId));

  revalidatePath("/admin/mitglieder");
  return { status: "ok" };
}

// Soft-Delete (FZ-006): Status → „geloescht". Der Datensatz bleibt physisch erhalten, damit
// bestehende Buchungen/Anwesenheits-/Storno-Historie (Nachweis-Zeitstempel) nicht verwaisen.
// Gelöschte Mitglieder verschwinden aus der aktiven Liste und können sich nicht mehr anmelden
// (Enforcement in lib/auth: getBenutzer + login).
export async function loescheMitglied(mitgliedId: string): Promise<MitgliedErgebnis> {
  await requireRolle("admin");

  if (!mitgliedId) return { status: "fehler", meldung: "Mitglied nicht gefunden." };

  await db
    .update(mitglied)
    .set({ status: "geloescht" })
    .where(eq(mitglied.mitgliedId, mitgliedId));

  revalidatePath("/admin/mitglieder");
  return { status: "ok" };
}
