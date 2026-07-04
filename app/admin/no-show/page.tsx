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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">No-Show-Auswertung</h1>
      <p className="mt-1 text-sm text-gray-500">
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

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">Mitglied</th>
              <th className="py-2 pr-4 font-medium">Tarif</th>
              <th className="py-2 pr-4 font-medium">No-Shows</th>
              <th className="py-2 pr-4 font-medium">Hinweis</th>
            </tr>
          </thead>
          <tbody>
            {eintraege.map((e) => (
              <tr
                key={e.mitgliedId}
                className={`border-b border-gray-100 ${e.hinweis ? "bg-red-50" : ""}`}
              >
                <td className="py-2 pr-4">{e.mitgliedName}</td>
                <td className="py-2 pr-4 text-gray-600">{e.tarif}</td>
                <td className="py-2 pr-4 font-medium">{e.anzahl}</td>
                <td className="py-2 pr-4">
                  {e.hinweis && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                      ab Schwelle
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {eintraege.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-gray-500">
                  Keine No-Shows im Zeitraum.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
