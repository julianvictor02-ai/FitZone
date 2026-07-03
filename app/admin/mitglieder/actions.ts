"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { mitglied } from "@/lib/db/schema";
import { requireRolle } from "@/lib/auth/benutzer";

// FZ-006 — Mitgliederstammdaten, admin-gepflegt. Nur Admin.

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

export async function aktualisiereMitglied(formData: FormData) {
  await requireRolle("admin");

  const mitgliedId = String(formData.get("mitgliedId") ?? "");
  const tarifId = String(formData.get("tarifId") ?? "");
  const status = String(formData.get("status") ?? "") as "aktiv" | "pausiert";

  if (!mitgliedId) return;

  await db
    .update(mitglied)
    .set({ tarifId, status })
    .where(eq(mitglied.mitgliedId, mitgliedId));

  revalidatePath("/admin/mitglieder");
}
