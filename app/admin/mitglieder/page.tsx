import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { mitglied, tarif } from "@/lib/db/schema";
import { requireRolle } from "@/lib/auth/benutzer";
import { erstelleMitglied, aktualisiereMitglied } from "./actions";

export default async function MitgliederPage() {
  await requireRolle("admin");

  const [mitglieder, tarife] = await Promise.all([
    db
      .select({
        mitgliedId: mitglied.mitgliedId,
        name: mitglied.name,
        email: mitglied.email,
        status: mitglied.status,
        tarifId: mitglied.tarifId,
        mitgliedschaftBis: mitglied.mitgliedschaftBis,
      })
      .from(mitglied)
      .orderBy(asc(mitglied.name)),
    db.select().from(tarif).orderBy(asc(tarif.name)),
  ]);

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Mitglieder-Verwaltung</h1>
        <p className="subtitle">
          Stammdaten, Tarif und Status — nur durch Admin pflegbar (FZ-006).
        </p>
      </header>

      {/* Neues Mitglied */}
      <section>
        <h2 className="section-title">Neues Mitglied</h2>
        <form action={erstelleMitglied} className="card flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Name
            <input name="name" required className="input" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            E-Mail
            <input type="email" name="email" required className="input" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Tarif
            <select name="tarifId" required className="input">
              {tarife.map((t) => (
                <option key={t.tarifId} value={t.tarifId}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Mitgliedschaft bis
            <input type="date" name="mitgliedschaftBis" className="input" />
          </label>
          <button type="submit" className="btn btn-primary btn-block">
            Anlegen
          </button>
        </form>
      </section>

      {/* Bestehende Mitglieder */}
      <section className="section">
        <h2 className="section-title">Mitglieder ({mitglieder.length})</h2>
        <ul className="stack">
          {mitglieder.map((m) => (
            <li key={m.mitgliedId} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-ink">{m.name}</div>
                  <div className="text-sm text-muted break-all">{m.email}</div>
                </div>
                <span
                  className={`badge shrink-0 ${m.status === "aktiv" ? "badge-success" : "badge-muted"}`}
                >
                  {m.status}
                </span>
              </div>
              <form action={aktualisiereMitglied} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="mitgliedId" value={m.mitgliedId} />
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Tarif
                  <select name="tarifId" defaultValue={m.tarifId} className="input">
                    {tarife.map((t) => (
                      <option key={t.tarifId} value={t.tarifId}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Status
                  <select name="status" defaultValue={m.status} className="input">
                    <option value="aktiv">aktiv</option>
                    <option value="pausiert">pausiert</option>
                  </select>
                </label>
                <button type="submit" className="btn btn-outline btn-block">
                  Speichern
                </button>
              </form>
            </li>
          ))}
          {mitglieder.length === 0 && <li className="empty">Noch keine Mitglieder.</li>}
        </ul>
      </section>
    </main>
  );
}
