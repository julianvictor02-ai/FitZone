import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kurstyp, onDemandVideo } from "@/lib/db/schema";
import { requireRolle } from "@/lib/auth/benutzer";
import { Info } from "@/components/icons";
import { VideoHinzufuegen } from "./VideoHinzufuegen";
import { VideoVerwalten } from "./VideoVerwalten";

// FZ-027 — Admin: On-Demand-Videos verwalten (YouTube-Links). Nutzt die bestehende
// OnDemandVideo-Entität; die tarif-gefilterte Wiedergabe bei Mitgliedern (BR7) bleibt
// unverändert in app/videos. Nur Admin.

export default async function AdminVideosPage() {
  await requireRolle("admin");

  const [videos, kurstypen] = await Promise.all([
    db
      .select({
        videoId: onDemandVideo.videoId,
        titel: onDemandVideo.titel,
        kurstypId: onDemandVideo.kurstypId,
        kurstypName: kurstyp.name,
        level: onDemandVideo.level,
        dauerMinuten: onDemandVideo.dauerMinuten,
        mindestTarif: onDemandVideo.mindestTarif,
        plattform: onDemandVideo.plattform,
        url: onDemandVideo.url,
      })
      .from(onDemandVideo)
      .leftJoin(kurstyp, eq(onDemandVideo.kurstypId, kurstyp.kurstypId))
      // Soft-gelöschte Videos verschwinden aus der Liste (FZ-027).
      .where(eq(onDemandVideo.geloescht, false))
      .orderBy(asc(onDemandVideo.titel)),
    db
      .select({ kurstypId: kurstyp.kurstypId, name: kurstyp.name })
      .from(kurstyp)
      .orderBy(asc(kurstyp.name)),
  ]);

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Videos verwalten</h1>
        <p className="subtitle">
          On-Demand-Videos (YouTube) für Mitglieder pflegen. Sichtbar ab dem gewählten
          Mindest-Tarif (Plus/Premium), Wiedergabe in der App (FZ-027).
        </p>
      </header>

      {/* Video hinzufügen */}
      <section>
        <h2 className="section-title">Neues Video</h2>
        <VideoHinzufuegen kurstypen={kurstypen} />
        <p className="hinweis mt-3">
          <Info /> Füge einen YouTube-Link ein (youtube.com/watch?v=…, youtu.be/… oder …/embed/…).
          Die Video-ID wird automatisch erkannt; abgespielt wird in der App.
        </p>
      </section>

      {/* Bestehende Videos */}
      <section className="section">
        <h2 className="section-title">Videos ({videos.length})</h2>
        <ul className="stack">
          {videos.map((v) => (
            <li key={v.videoId} className="card">
              <VideoVerwalten video={v} kurstypen={kurstypen} />
            </li>
          ))}
          {videos.length === 0 && <li className="empty">Noch keine Videos.</li>}
        </ul>
      </section>
    </main>
  );
}
