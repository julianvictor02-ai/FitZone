"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Video } from "@/components/icons";
import { erstelleVideo } from "./actions";
import { VideoFelder, type Kurstyp } from "./VideoFelder";

// FZ-027 — „Video hinzufügen": Button öffnet das Formular. Bei ungültigem YouTube-Link
// zeigt die Server-Action eine klare Fehlermeldung (nichts wird gespeichert); bei Erfolg
// Toast + zurück zur Videoliste.

export function VideoHinzufuegen({ kurstypen }: { kurstypen: Kurstyp[] }) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [pending, start] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function zeigeToast(text: string, ok: boolean) {
    setToast({ text, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  function speichern(formData: FormData) {
    setFehler(null);
    start(async () => {
      const r = await erstelleVideo(formData);
      if (r.status === "ok") {
        formRef.current?.reset();
        setOffen(false);
        zeigeToast("Video hinzugefügt ✓", true);
        router.refresh();
      } else {
        setFehler(r.meldung);
      }
    });
  }

  if (!offen) {
    return (
      <>
        <button onClick={() => setOffen(true)} className="btn btn-primary btn-block">
          <Video /> Video hinzufügen
        </button>
        {toast && (
          <div className={`toast ${toast.ok ? "toast-ok" : ""}`} role="status" aria-live="polite">
            {toast.ok ? <CheckCircle /> : <XCircle />}
            {toast.text}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <form ref={formRef} action={speichern} className="card flex flex-col gap-3">
        <VideoFelder kurstypen={kurstypen} />

        {fehler && (
          <p className="rounded-card border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {fehler}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setOffen(false);
              setFehler(null);
            }}
            disabled={pending}
            className="btn btn-outline btn-block"
          >
            Abbrechen
          </button>
          <button type="submit" disabled={pending} className="btn btn-primary btn-block">
            {pending ? <span className="spinner" /> : "Speichern"}
          </button>
        </div>
      </form>

      {toast && (
        <div className={`toast ${toast.ok ? "toast-ok" : ""}`} role="status" aria-live="polite">
          {toast.ok ? <CheckCircle /> : <XCircle />}
          {toast.text}
        </div>
      )}
    </>
  );
}
