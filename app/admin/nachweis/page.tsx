import { requireRolle } from "@/lib/auth/benutzer";
import { ladeNachweisEreignisse, type NachweisVorgang } from "@/lib/audit/nachweis";

// FZ-008 — Buchungsnachweis: konsolidiertes, auditierbares Zeitstempel-Log aller
// Vorgänge (nur Admin, read-only). Löst Streitfälle „ich hab gebucht" (spec §9).

const DATUM_ZEIT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const DATUM = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const VORGANG_LABEL: Record<NachweisVorgang, string> = {
  gebucht: "Gebucht",
  storniert: "Storniert",
  anwesenheit_erfasst: "Anwesenheit erfasst",
  warteliste_beigetreten: "Warteliste beigetreten",
  nachrueck_angebot: "Nachrück-Angebot",
};

const VORGANG_FARBE: Record<NachweisVorgang, string> = {
  gebucht: "bg-green-100 text-green-800",
  storniert: "bg-gray-200 text-gray-700",
  anwesenheit_erfasst: "bg-blue-100 text-blue-800",
  warteliste_beigetreten: "bg-amber-100 text-amber-800",
  nachrueck_angebot: "bg-amber-100 text-amber-800",
};

export default async function NachweisPage() {
  await requireRolle("admin");

  const ereignisse = await ladeNachweisEreignisse();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold">Buchungsnachweis</h1>
      <p className="mt-1 text-sm text-gray-500">
        Auditierbares Zeitstempel-Log aller Vorgänge, neueste zuerst (FZ-008, §6). Die
        Zeitstempel sind unveränderbar (&bdquo;nicht verhandelbar&ldquo;).
      </p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">Zeitstempel</th>
              <th className="py-2 pr-4 font-medium">Vorgang</th>
              <th className="py-2 pr-4 font-medium">Mitglied</th>
              <th className="py-2 pr-4 font-medium">Kurs</th>
            </tr>
          </thead>
          <tbody>
            {ereignisse.map((e, i) => (
              <tr key={i} className="border-b border-gray-100 align-top">
                <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs">
                  {DATUM_ZEIT.format(e.zeitpunkt)}
                </td>
                <td className="py-2 pr-4">
                  <span className={`rounded px-2 py-0.5 text-xs ${VORGANG_FARBE[e.vorgang]}`}>
                    {VORGANG_LABEL[e.vorgang]}
                  </span>
                  {e.detail && <span className="ml-2 text-xs text-gray-500">{e.detail}</span>}
                </td>
                <td className="py-2 pr-4">{e.mitgliedName}</td>
                <td className="py-2 pr-4 text-gray-600">
                  {e.kurstyp} · {DATUM.format(e.kursStart)} Uhr
                </td>
              </tr>
            ))}
            {ereignisse.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-gray-500">
                  Noch keine Vorgänge.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
