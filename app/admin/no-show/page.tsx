import { requireRolle } from "@/lib/auth/benutzer";
import {
  ladeNoShowAuswertung,
  NO_SHOW_SCHWELLE,
  NO_SHOW_FENSTER_TAGE,
} from "@/lib/attendance/noshow";

// FZ-013 — No-Show-Auswertung (BR6): Admin-Hinweis ab Schwelle, keine Auto-Sperre.

export default async function NoShowPage() {
  await requireRolle("admin");

  const eintraege = await ladeNoShowAuswertung();
  const markiert = eintraege.filter((e) => e.hinweis);

  return (
    <main className="page">
      <h1 className="text-2xl font-bold text-ink">No-Show-Auswertung</h1>
      <p className="mt-1 text-sm text-muted">
        No-Shows je Mitglied der letzten {NO_SHOW_FENSTER_TAGE} Tage. Hinweis ab{" "}
        {NO_SHOW_SCHWELLE} No-Shows — <strong>keine automatische Sperre</strong> (BR6); die
        Konsequenz entscheidet der Admin.
      </p>

      {markiert.length > 0 && (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {markiert.length} Mitglied(er) ab Schwelle ({NO_SHOW_SCHWELLE}+ No-Shows) — bitte
          prüfen.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {eintraege.map((e) => (
          <li
            key={e.mitgliedId}
            className={`rounded-card border p-4 ${
              e.hinweis ? "border-red-200 bg-red-50" : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-ink">{e.mitgliedName}</div>
                <div className="text-sm text-muted">{e.tarif}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-ink">{e.anzahl}</div>
                <div className="text-xs text-muted">No-Shows</div>
              </div>
            </div>
            {e.hinweis && (
              <span className="mt-2 inline-block rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                ab Schwelle
              </span>
            )}
          </li>
        ))}
        {eintraege.length === 0 && (
          <li className="rounded-card border border-gray-200 p-4 text-sm text-muted">
            Keine No-Shows im Zeitraum.
          </li>
        )}
      </ul>
    </main>
  );
}
