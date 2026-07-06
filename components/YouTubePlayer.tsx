"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Play, XCircle } from "@/components/icons";

// FZ-011 — In-App-YouTube-Player. Öffnet ein Modal mit dem offiziellen IFrame-Embed
// im privacy-enhanced Modus (youtube-nocookie.com) — kein Wechsel zu youtube.com,
// kein Klartext-Watch-Link. Responsiver 16:9-Container (aspect-ratio).
//
// Zugriffskontrolle passiert server-seitig: Die Videos-Query liefert Basic-Nutzern
// keine Zeilen (BR7), daher wird diese Komponente für sie nie gerendert — die
// Video-ID gelangt gar nicht erst in deren HTML.

// Robust: akzeptiert die reine 11-stellige ID oder eine YouTube-URL.
function ytId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function YouTubePlayer({
  videoId,
  titel,
  className,
}: {
  videoId: string;
  titel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = ytId(videoId);
  if (!id) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn btn-primary btn-block ${className ?? ""}`}
      >
        <Play /> Abspielen
      </button>

      {open &&
        createPortal(
          // Als Portal an document.body: verhindert, dass ein transformierter
          // Vorfahr (z. B. die animierte .stack-Card) das fixe Overlay einfängt.
          <div
            className="player-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={titel}
            onClick={() => setOpen(false)}
          >
            <div className="player-box" onClick={(e) => e.stopPropagation()}>
              <div className="player-frame">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1`}
                  title={titel}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-outline btn-block">
                <XCircle /> Schließen
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
