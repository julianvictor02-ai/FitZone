"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { kurstyp } from "@/lib/db/schema";
import { requireRolle } from "@/lib/auth/benutzer";

// FZ-016 — Einzelkurs-Preis je Kursart pflegen (Basis der Stornogebühr). Nur Admin.

export async function setzeEinzelpreis(formData: FormData) {
  await requireRolle("admin");

  const kurstypId = String(formData.get("kurstypId") ?? "");
  const roh = String(formData.get("einzelpreis") ?? "").trim().replace(",", ".");
  if (!kurstypId) return;

  // Leer → Preis löschen (null). Sonst nicht-negativer Betrag mit 2 Nachkommastellen.
  let wert: string | null = null;
  if (roh !== "") {
    const n = Number(roh);
    if (!Number.isFinite(n) || n < 0) return;
    wert = n.toFixed(2);
  }

  await db.update(kurstyp).set({ einzelpreis: wert }).where(eq(kurstyp.kurstypId, kurstypId));
  revalidatePath("/admin/kurstypen");
}
