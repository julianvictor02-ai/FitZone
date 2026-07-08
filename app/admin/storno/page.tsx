import { requireRolle } from "@/lib/auth/benutzer";
import { ladeOffeneStornoGebuehren } from "@/lib/booking/stornoGebuehr";
import { bestaetigeGebuehr, erlasseGebuehr } from "./actions";
import { Euro, Clock } from "@/components/icons";

// Ausnahme-Fall (BR5): fällige Stornogebühren, die der Admin pro Buchung erlässt oder
// bestätigt — inline, ohne Seitenwechsel. Abwicklung/Abbuchung bleibt manuell (kein Payment v1).

const DATUM = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const DATUM_ZEIT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export default async function StornoGebuehrenPage() {
  await requireRolle("admin");

  const offene = await ladeOffeneStornoGebuehren();

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Storno-Gebühren</h1>
        <p className="subtitle">
          Offene Gebührenfälle (BR5): kurzfristige Stornos ohne Befreiung. Pro Buchung{" "}
          <strong>bestätigen</strong> oder <strong>erlassen</strong> — die Abbuchung erfolgt
          manuell außerhalb (kein Payment in v1).
        </p>
      </header>

      <ul className="stack">
        {offene.map((g) => (
          <li key={g.buchungId} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-ink">{g.mitgliedName}</div>
                <div className="text-sm text-muted">
                  {g.kurstyp} · {DATUM.format(g.kursStart)} Uhr
                </div>
                {g.stornozeitpunkt && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <Clock /> Storniert am {DATUM_ZEIT.format(g.stornozeitpunkt)} Uhr
                  </div>
                )}
              </div>
              <span className="badge badge-danger shrink-0">
                <Euro /> {g.betrag != null ? EUR.format(g.betrag) : "Betrag offen"}
              </span>
            </div>

            {/* Inline-Entscheidung: kein Seitenwechsel, revalidiert die Liste. */}
            <div className="mt-3 flex gap-3">
              <form action={bestaetigeGebuehr} className="flex-1">
                <input type="hidden" name="buchungId" value={g.buchungId} />
                <button type="submit" className="btn btn-primary btn-block">
                  Bestätigen
                </button>
              </form>
              <form action={erlasseGebuehr} className="flex-1">
                <input type="hidden" name="buchungId" value={g.buchungId} />
                <button type="submit" className="btn btn-outline btn-block">
                  Erlassen
                </button>
              </form>
            </div>
          </li>
        ))}
        {offene.length === 0 && (
          <li className="empty">Keine offenen Storno-Gebühren.</li>
        )}
      </ul>
    </main>
  );
}
