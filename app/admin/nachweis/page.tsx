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
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Buchungsnachweis</h1>
        <p className="subtitle">
          Auditierbares Zeitstempel-Log aller Vorgänge, neueste zuerst (FZ-008, §6). Die
          Zeitstempel sind unveränderbar (&bdquo;nicht verhandelbar&ldquo;).
        </p>
      </header>

      <ul className="stack">
        {ereignisse.map((e, i) => (
          <li key={i} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${VORGANG_FARBE[e.vorgang]}`}>
                {VORGANG_LABEL[e.vorgang]}
              </span>
              <span className="font-mono text-xs text-muted">
                {DATUM_ZEIT.format(e.zeitpunkt)}
              </span>
            </div>
            <div className="mt-2 font-medium text-ink">{e.mitgliedName}</div>
            <div className="text-sm text-muted">
              {e.kurstyp} · {DATUM.format(e.kursStart)} Uhr
            </div>
            {e.detail && <div className="mt-1 text-xs text-muted">{e.detail}</div>}
          </li>
        ))}
        {ereignisse.length === 0 && <li className="empty">Noch keine Vorgänge.</li>}
      </ul>
    </main>
  );
}
