"use server";

import { revalidatePath } from "next/cache";
import { requireRolle } from "@/lib/auth/benutzer";
import { sageKursterminAb, verschiebeKurstermin } from "@/lib/kurstermin/status";

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
