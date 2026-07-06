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
      <header className="page-header">
        <h1 className="page-title">No-Show-Auswertung</h1>
        <p className="subtitle">
          No-Shows je Mitglied der letzten {NO_SHOW_FENSTER_TAGE} Tage. Hinweis ab{" "}
          {NO_SHOW_SCHWELLE} No-Shows — <strong>keine automatische Sperre</strong> (BR6); die
          Konsequenz entscheidet der Admin.
        </p>
      </header>

      {markiert.length > 0 && (
        <p className="mb-4 rounded-btn bg-red-50 px-3 py-2 text-sm text-red-800">
          {markiert.length} Mitglied(er) ab Schwelle ({NO_SHOW_SCHWELLE}+ No-Shows) — bitte
          prüfen.
        </p>
      )}

      <ul className="stack">
        {eintraege.map((e) => (
          <li
            key={e.mitgliedId}
            className={e.hinweis ? "card !border-red-200 !bg-red-50" : "card"}
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
            {e.hinweis && <span className="badge badge-danger mt-2">ab Schwelle</span>}
          </li>
        ))}
        {eintraege.length === 0 && <li className="empty">Keine No-Shows im Zeitraum.</li>}
      </ul>
    </main>
  );
}
