"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle } from "@/components/icons";
import { aktualisiereVideo, loescheVideo } from "./actions";
import { VideoFelder, type Kurstyp, type VideoDaten } from "./VideoFelder";

// FZ-027 — Ein bestehendes On-Demand-Video: Leseansicht ↔ Bearbeiten und Soft-Delete
// mit zweistufiger Bestätigung (analog Mitglied FZ-006). Validierung server-seitig.

type Video = VideoDaten & { videoId: string; kurstypName: string | null; plattform: string | null };

export function VideoVerwalten({ video, kurstypen }: { video: Video; kurstypen: Kurstyp[] }) {
  const router = useRouter();
  const [bearbeiten, setBearbeiten] = useState(false);
  const [dialogOffen, setDialogOffen] = useState(false);
  const [pending, start] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function zeigeToast(text: string, ok: boolean) {
    setToast({ text, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  function speichern(formData: FormData) {
    setFehler(null);
    start(async () => {
      const r = await aktualisiereVideo(formData);
      if (r.status === "ok") {
        setBearbeiten(false);
        zeigeToast("Änderungen gespeichert ✓", true);
        router.refresh();
      } else {
        setFehler(r.meldung);
      }
    });
  }

  function loeschen() {
    setDialogOffen(false);
    start(async () => {
      const r = await loescheVideo(video.videoId);
      if (r.status === "ok") {
        zeigeToast(`„${video.titel}" gelöscht`, true);
        router.refresh();
      } else {
        zeigeToast(r.meldung, false);
      }
    });
  }

  const meta = [
    video.kurstypName,
    video.level,
    video.dauerMinuten ? `${video.dauerMinuten} Min` : null,
    `ab ${video.mindestTarif}`,
    video.plattform,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold text-ink leading-tight">{video.titel}</div>
          <div className="mt-1 text-sm text-muted">{meta}</div>
        </div>
        <span className="badge badge-success shrink-0">{video.mindestTarif}</span>
      </div>

      {!bearbeiten ? (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              setFehler(null);
              setBearbeiten(true);
            }}
            disabled={pending}
            className="btn btn-outline btn-block"
          >
            Bearbeiten
          </button>
          <button
            onClick={() => setDialogOffen(true)}
            disabled={pending}
            className="btn btn-danger btn-block"
          >
            Löschen
          </button>
        </div>
      ) : (
        <form action={speichern} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="videoId" value={video.videoId} />
          <VideoFelder kurstypen={kurstypen} video={video} />

          {fehler && (
            <p className="rounded-card border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {fehler}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setBearbeiten(false);
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
      )}

      {dialogOffen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Video löschen"
          onClick={() => setDialogOffen(false)}
        >
          <div className="card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-ink leading-tight">Sicher löschen?</h3>
            <p className="mt-2 text-sm text-muted">
              <strong className="text-ink">„{video.titel}“</strong> wird für Mitglieder ausgeblendet.
              Der Datensatz bleibt erhalten und lässt sich später wieder einblenden.
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setDialogOffen(false)} className="btn btn-outline btn-block">
                Abbrechen
              </button>
              <button onClick={loeschen} className="btn btn-danger btn-block">
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.ok ? "toast-ok" : ""}`} role="status" aria-live="polite">
          {toast.ok ? <CheckCircle /> : <XCircle />}
          {toast.text}
        </div>
      )}
    </>
  );
}
