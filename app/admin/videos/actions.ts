"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { onDemandVideo } from "@/lib/db/schema";
import { requireRolle } from "@/lib/auth/benutzer";
import { extrahiereYoutubeId } from "@/lib/content/youtube";

// FZ-027 — Admin verwaltet On-Demand-Videos (YouTube). Nutzt die bestehende
// OnDemandVideo-Entität: plattform="YouTube", url = extrahierte Video-ID (BR7-Zugriff
// bleibt server-seitig in app/videos). Nur Admin.

export type VideoErgebnis =
  | { status: "ok" }
  | { status: "fehler"; meldung: string };

const LEVELS = ["Anfaenger", "Mittel", "Fortgeschritten"] as const;

// Validiert die gemeinsamen Formularfelder (Anlegen + Bearbeiten) und liefert entweder
// die fertigen DB-Werte oder eine verständliche Fehlermeldung (kein Speichern).
type VideoWerte = {
  titel: string;
  kurstypId: string;
  level: string | null;
  dauerMinuten: number | null;
  mindestTarif: "Plus" | "Premium";
  url: string;
};

function leseUndValidiere(formData: FormData): { ok: true; werte: VideoWerte } | { ok: false; meldung: string } {
  const link = String(formData.get("youtubeLink") ?? "").trim();
  const titel = String(formData.get("titel") ?? "").trim();
  const kurstypId = String(formData.get("kurstypId") ?? "").trim();
  const mindestTarif = String(formData.get("mindestTarif") ?? "").trim();
  const level = String(formData.get("level") ?? "").trim();
  const dauerRoh = String(formData.get("dauerMinuten") ?? "").trim();

  if (!titel) return { ok: false, meldung: "Titel ist ein Pflichtfeld." };

  const videoId = extrahiereYoutubeId(link);
  if (!videoId) {
    return {
      ok: false,
      meldung:
        "Kein gültiger YouTube-Link erkannt. Erlaubt sind z. B. youtube.com/watch?v=…, youtu.be/… oder youtube.com/embed/… (oder die reine Video-ID).",
    };
  }

  if (!kurstypId) return { ok: false, meldung: "Kurstyp ist ein Pflichtfeld." };
  if (mindestTarif !== "Plus" && mindestTarif !== "Premium") {
    return { ok: false, meldung: "Mindest-Tarif muss Plus oder Premium sein." };
  }
  if (level && !(LEVELS as readonly string[]).includes(level)) {
    return { ok: false, meldung: "Ungültiges Level." };
  }

  let dauerMinuten: number | null = null;
  if (dauerRoh) {
    const n = Number.parseInt(dauerRoh, 10);
    if (!Number.isInteger(n) || n <= 0) {
      return { ok: false, meldung: "Dauer muss eine positive Zahl (Minuten) sein." };
    }
    dauerMinuten = n;
  }

  return {
    ok: true,
    werte: { titel, kurstypId, level: level || null, dauerMinuten, mindestTarif, url: videoId },
  };
}

export async function erstelleVideo(formData: FormData): Promise<VideoErgebnis> {
  await requireRolle("admin");

  const v = leseUndValidiere(formData);
  if (!v.ok) return { status: "fehler", meldung: v.meldung };

  await db.insert(onDemandVideo).values({ ...v.werte, plattform: "YouTube" });

  revalidatePath("/admin/videos");
  revalidatePath("/videos");
  return { status: "ok" };
}

export async function aktualisiereVideo(formData: FormData): Promise<VideoErgebnis> {
  await requireRolle("admin");

  const videoId = String(formData.get("videoId") ?? "");
  if (!videoId) return { status: "fehler", meldung: "Video nicht gefunden." };

  const v = leseUndValidiere(formData);
  if (!v.ok) return { status: "fehler", meldung: v.meldung };

  await db
    .update(onDemandVideo)
    .set({ ...v.werte, plattform: "YouTube" })
    .where(eq(onDemandVideo.videoId, videoId));

  revalidatePath("/admin/videos");
  revalidatePath("/videos");
  return { status: "ok" };
}

// Soft-Delete (analog Mitglied FZ-006): geloescht=true. Der Datensatz bleibt erhalten,
// verschwindet aber aus Admin-Liste und Mitglieder-Videos.
export async function loescheVideo(videoId: string): Promise<VideoErgebnis> {
  await requireRolle("admin");

  if (!videoId) return { status: "fehler", meldung: "Video nicht gefunden." };

  await db.update(onDemandVideo).set({ geloescht: true }).where(eq(onDemandVideo.videoId, videoId));

  revalidatePath("/admin/videos");
  revalidatePath("/videos");
  return { status: "ok" };
}
