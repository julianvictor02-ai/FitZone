import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { requireRolle } from "@/lib/auth/benutzer";
import { db } from "@/lib/db";
import { kurstyp, mitglied, onDemandVideo, tarif } from "@/lib/db/schema";
import { erlaubteVideoTarife, type TarifName } from "@/lib/content/zugriff";
import { Play, Video } from "@/components/icons";
import { YouTubePlayer } from "@/components/YouTubePlayer";

// FZ-011 — On-Demand-Videos, tarif-gefiltert (BR7). Die Query liefert nur Videos, deren
// mindest_tarif der Tarif des Mitglieds erreicht — Basic sieht keine (unerlaubter
// Zugriff wird server-seitig blockiert, kein URL wird ausgegeben).

export default async function VideosPage() {
  const me = await requireRolle("mitglied");
  if (!me.mitgliedId) {
    return (
      <main className="page">
        <h1 className="text-2xl font-bold text-ink">On-Demand-Videos</h1>
        <p className="mt-3 text-sm text-red-700">
          Deinem Konto ist kein Mitglied-Profil zugeordnet. Bitte an den Admin wenden.
        </p>
      </main>
    );
  }

  const [stamm] = await db
    .select({ tarif: tarif.name })
    .from(mitglied)
    .innerJoin(tarif, eq(mitglied.tarifId, tarif.tarifId))
    .where(eq(mitglied.mitgliedId, me.mitgliedId));
  const tarifName = (stamm?.tarif ?? "Basic") as TarifName;

  const erlaubt = erlaubteVideoTarife(tarifName);
  const videos = erlaubt.length
    ? await db
        .select({
          videoId: onDemandVideo.videoId,
          titel: onDemandVideo.titel,
          kurstyp: kurstyp.name,
          level: onDemandVideo.level,
          dauer: onDemandVideo.dauerMinuten,
          mindestTarif: onDemandVideo.mindestTarif,
          plattform: onDemandVideo.plattform,
          url: onDemandVideo.url,
        })
        .from(onDemandVideo)
        .leftJoin(kurstyp, eq(onDemandVideo.kurstypId, kurstyp.kurstypId))
        .where(inArray(onDemandVideo.mindestTarif, erlaubt))
        .orderBy(asc(onDemandVideo.titel))
    : [];

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">On-Demand-Videos</h1>
        <p className="subtitle">
          Dein Tarif: <strong>{tarifName}</strong>. On-Demand ist ab Plus verfügbar.{" "}
          <Link href="/mein-bereich">Mein Bereich</Link>
        </p>
      </header>

      {erlaubt.length === 0 ? (
        <p className="rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Für den Tarif <strong>Basic</strong> sind keine On-Demand-Videos verfügbar. Mit{" "}
          <strong>Plus</strong> oder <strong>Premium</strong> (Tarifwechsel über den Admin)
          erhältst du Zugriff.
        </p>
      ) : videos.length === 0 ? (
        <p className="empty">
          <span className="empty-icon">
            <Video />
          </span>
          <span>Zurzeit keine Videos verfügbar.</span>
        </p>
      ) : (
        <ul className="stack">
          {videos.map((v) => (
            <li key={v.videoId} className="card">
              <div className="flex items-start gap-3">
                <div className="icon-tile">
                  <Play />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-ink leading-tight">{v.titel}</div>
                  <div className="mt-1 text-sm text-muted">
                    {[v.kurstyp, v.level, v.dauer ? `${v.dauer} Min` : null, v.mindestTarif ? `ab ${v.mindestTarif}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                {!v.url && <span className="badge badge-muted shrink-0">kein Link</span>}
              </div>
              {/* YouTube: In-App-Player (kein Verlassen der App). Sonstige Plattformen:
                  bestehender externer Link — Logik unverändert. */}
              {v.plattform === "YouTube" && v.url ? (
                <YouTubePlayer videoId={v.url} titel={v.titel} className="mt-3" />
              ) : v.url ? (
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-block mt-3"
                >
                  <Play /> Ansehen{v.plattform ? ` (${v.plattform})` : ""}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
