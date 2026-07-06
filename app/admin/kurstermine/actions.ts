"use server";

import { revalidatePath } from "next/cache";
import { requireRolle } from "@/lib/auth/benutzer";
import { sageKursterminAb, verschiebeKurstermin } from "@/lib/kurstermin/status";
import { gibKursterminFrei, lehneVorschlagAb } from "@/lib/kurstermin/vorschlag";

// FZ-009 — Admin sagt Kurstermine ab / verschiebt sie; löst Benachrichtigung aus (BR8).

export async function sageAb(formData: FormData) {
  await requireRolle("admin");

  const kursterminId = String(formData.get("kursterminId") ?? "");
  if (!kursterminId) return;

  await sageKursterminAb(kursterminId);
  revalidatePath("/admin/kurstermine");
}

export async function verschiebe(formData: FormData) {
  await requireRolle("admin");

  const kursterminId = String(formData.get("kursterminId") ?? "");
  const neuerStartRaw = String(formData.get("neuerStart") ?? "").trim();
  if (!kursterminId || !neuerStartRaw) return;

  await verschiebeKurstermin(kursterminId, new Date(neuerStartRaw));
  revalidatePath("/admin/kurstermine");
}

// FZ-020 — Admin gibt einen Trainer-Vorschlag frei (→ geplant); danach für Mitglieder buchbar.
export async function gibFrei(formData: FormData) {
  await requireRolle("admin");

  const kursterminId = String(formData.get("kursterminId") ?? "");
  if (!kursterminId) return;

  await gibKursterminFrei(kursterminId);
  revalidatePath("/admin/kurstermine");
}

// FZ-020 — Admin lehnt einen Vorschlag ab (löscht ihn).
export async function lehneAb(formData: FormData) {
  await requireRolle("admin");

  const kursterminId = String(formData.get("kursterminId") ?? "");
  if (!kursterminId) return;

  await lehneVorschlagAb(kursterminId);
  revalidatePath("/admin/kurstermine");
}
