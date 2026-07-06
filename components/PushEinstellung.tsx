"use client";

import { useEffect, useState } from "react";
import type { PushAboEingang } from "@/lib/push/abo";

// FZ-019/FZ-022 — „Benachrichtigungen aktivieren" (Web-Push). Registriert den Service
// Worker, fragt die Berechtigung ab, abonniert und meldet das Abo an den Server. Die
// konkreten Server-Actions (Mitglied bzw. Trainer) werden als Props injiziert, damit
// dieselbe Browser-Logik für beide Rollen wiederverwendbar ist. Versand: lib/notify.ts.

type Status = "laden" | "kein_key" | "nicht_unterstuetzt" | "blockiert" | "aus" | "an";

// VAPID-Public-Key (base64url) → Uint8Array für applicationServerKey.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushEinstellung({
  vapidKey,
  aktiviereAbo,
  deaktiviereAbo,
}: {
  vapidKey: string | null;
  aktiviereAbo: (sub: PushAboEingang) => Promise<unknown>;
  deaktiviereAbo: (endpoint: string) => Promise<unknown>;
}) {
  const [status, setStatus] = useState<Status>("laden");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!vapidKey) return setStatus("kein_key");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return setStatus("nicht_unterstuetzt");
    }
    if (Notification.permission === "denied") return setStatus("blockiert");

    navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setStatus(sub ? "an" : "aus");
      })
      .catch(() => setStatus("aus"));
  }, [vapidKey]);

  async function aktiviere() {
    if (!vapidKey) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "blockiert" : "aus");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
      const json = sub.toJSON();
      if (json.keys?.p256dh && json.keys?.auth) {
        await aktiviereAbo({ endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth });
        setStatus("an");
      } else {
        setStatus("aus");
      }
    } catch {
      setStatus("aus");
    } finally {
      setBusy(false);
    }
  }

  async function deaktiviere() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await deaktiviereAbo(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("aus");
    } catch {
      /* Zustand unverändert lassen */
    } finally {
      setBusy(false);
    }
  }

  const HINWEIS: Record<Status, string> = {
    laden: "…",
    kein_key: "Push ist auf diesem Server noch nicht konfiguriert.",
    nicht_unterstuetzt: "Dein Browser unterstützt keine Push-Benachrichtigungen.",
    blockiert: "Benachrichtigungen sind im Browser blockiert — bitte in den Seiteneinstellungen erlauben.",
    aus: "Erhalte wichtige Hinweise direkt aufs Gerät.",
    an: "Aktiv — du erhältst Push-Benachrichtigungen auf diesem Gerät.",
  };

  return (
    <section className="mt-8 rounded border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Benachrichtigungen</h2>
          <p className="mt-1 max-w-prose text-sm text-gray-500">{HINWEIS[status]}</p>
        </div>
        {status === "aus" && (
          <button
            onClick={aktiviere}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-btn bg-brand-strong px-4 text-sm font-medium text-white hover:bg-brand-strong-hover disabled:opacity-50"
          >
            {busy ? "…" : "Aktivieren"}
          </button>
        )}
        {status === "an" && (
          <button
            onClick={deaktiviere}
            disabled={busy}
            className="rounded border border-gray-400 px-4 py-2 text-sm disabled:opacity-50"
          >
            {busy ? "…" : "Deaktivieren"}
          </button>
        )}
      </div>
    </section>
  );
}
