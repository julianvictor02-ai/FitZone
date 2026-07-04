import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { requireRolle } from "@/lib/auth/benutzer";
import { db } from "@/lib/db";
import { kurstyp, mitglied, onDemandVideo, tarif } from "@/lib/db/schema";
import { erlaubteVideoTarife, type TarifName } from "@/lib/content/zugriff";

// FZ-011 — On-Demand-Videos, tarif-gefiltert (BR7). Die Query liefert nur Videos, deren
// mindest_tarif der Tarif des Mitglieds erreicht — Basic sieht keine (unerlaubter
// Zugriff wird server-seitig blockiert, kein URL wird ausgegeben).

export default async function VideosPage() {
  const me = await requireRolle("mitglied");
  if (!me.mitgliedId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold">On-Demand-Videos</h1>
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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">On-Demand-Videos</h1>
      <p className="mt-1 text-sm text-gray-500">
        Dein Tarif: <strong>{tarifName}</strong>. On-Demand ist ab Plus verfügbar.{" "}
        <Link href="/mein-bereich" className="underline">
          Mein Bereich
        </Link>
      </p>

      {erlaubt.length === 0 ? (
        <p className="mt-8 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Für den Tarif <strong>Basic</strong> sind keine On-Demand-Videos verfügbar. Mit{" "}
          <strong>Plus</strong> oder <strong>Premium</strong> (Tarifwechsel über den Admin)
          erhältst du Zugriff.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-200">
          {videos.map((v) => (
            <li key={v.videoId} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <div className="font-medium">{v.titel}</div>
                <div className="text-sm text-gray-500">
                  {[v.kurstyp, v.level, v.dauer ? `${v.dauer} Min` : null, v.mindestTarif ? `ab ${v.mindestTarif}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              {v.url ? (
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-black px-4 py-1.5 text-sm text-white"
                >
                  Ansehen{v.plattform ? ` (${v.plattform})` : ""}
                </a>
              ) : (
                <span className="text-sm text-gray-400">kein Link</span>
              )}
            </li>
          ))}
          {videos.length === 0 && (
            <li className="py-4 text-sm text-gray-500">Zurzeit keine Videos verfügbar.</li>
          )}
        </ul>
      )}
    </main>
  );
}
