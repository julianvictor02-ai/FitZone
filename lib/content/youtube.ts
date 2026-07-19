// FZ-027 — YouTube-Video-ID robust aus einem Link extrahieren.
// Genutzt beim Anlegen/Bearbeiten von On-Demand-Videos im Admin (app/admin/videos).
// Der Player (components/YouTubePlayer) arbeitet auf der so gespeicherten reinen ID.
//
// Unterstützte Eingaben (per URL-Parsing + Regex-Fallback, nicht per String-Schnitt):
//   - https://www.youtube.com/watch?v=ID  (auch mit &t=, &list=, … Parametern)
//   - https://youtu.be/ID                 (auch mit ?t=…)
//   - https://www.youtube.com/embed/ID    (auch youtube-nocookie.com)
//   - youtube.com/shorts/ID , /v/ID       (Kulanz)
//   - die reine 11-stellige Video-ID
//
// Eine YouTube-Video-ID ist genau 11 Zeichen aus [A-Za-z0-9_-].

const ID_MUSTER = /^[\w-]{11}$/;

export function extrahiereYoutubeId(input: string): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;

  // Reine Video-ID direkt akzeptieren.
  if (ID_MUSTER.test(s)) return s;

  // Als URL parsen (Schema ergänzen, falls es fehlt, z. B. "youtu.be/ID").
  let url: URL | null = null;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    url = null;
  }

  if (url) {
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();

    // youtu.be/ID → ID steht im Pfad.
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      if (ID_MUSTER.test(id)) return id;
    }

    // youtube.com / youtube-nocookie.com / m.youtube.com
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const v = url.searchParams.get("v");
      if (v && ID_MUSTER.test(v)) return v;
      const m = url.pathname.match(/^\/(?:embed|shorts|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  }

  // Fallback: ID aus einem der bekannten Muster im Rohstring ziehen.
  const m = s.match(/(?:[?&]v=|\/embed\/|\/shorts\/|\/v\/|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
