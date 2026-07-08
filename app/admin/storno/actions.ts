"use server";

import { revalidatePath } from "next/cache";
import { requireRolle } from "@/lib/auth/benutzer";
import { entscheideStornoGebuehr } from "@/lib/booking/stornoGebuehr";

// Admin entscheidet über eine fällige Stornogebühr direkt an der Buchung (BR5).

export async function bestaetigeGebuehr(formData: FormData) {
  await requireRolle("admin");

  const buchungId = String(formData.get("buchungId") ?? "");
  if (!buchungId) return;

  await entscheideStornoGebuehr(buchungId, "bestaetigt");
  revalidatePath("/admin/storno");
}

export async function erlasseGebuehr(formData: FormData) {
  await requireRolle("admin");

  const buchungId = String(formData.get("buchungId") ?? "");
  if (!buchungId) return;

  await entscheideStornoGebuehr(buchungId, "erlassen");
  revalidatePath("/admin/storno");
}
