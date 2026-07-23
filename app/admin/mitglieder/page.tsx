import { asc, isNotNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { benutzer, mitglied, tarif } from "@/lib/db/schema";
import { requireRolle } from "@/lib/auth/benutzer";
import { Info } from "@/components/icons";
import { erstelleMitglied } from "./actions";
import { MitgliedVerwalten } from "./MitgliedVerwalten";

export default async function MitgliederPage() {
  await requireRolle("admin");

  const [mitglieder, tarife, aktivierte] = await Promise.all([
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
      // Soft-gelöschte Mitglieder verschwinden aus der aktiven Liste (FZ-006).
      .where(ne(mitglied.status, "geloescht"))
      .orderBy(asc(mitglied.name)),
    db.select().from(tarif).orderBy(asc(tarif.name)),
    // Aktiviert = es existiert eine benutzer-Verknüpfung (Auth-Konto) zum Mitglied.
    db
      .select({ mitgliedId: benutzer.mitgliedId })
      .from(benutzer)
      .where(isNotNull(benutzer.mitgliedId)),
  ]);
  const aktiviertSet = new Set(aktivierte.map((a) => a.mitgliedId));

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
          <p className="hinweis">
            <Info /> Neu angelegte Mitglieder müssen ihr Konto selbst über &bdquo;Konto aktivieren&ldquo;
            (auf dem Anmeldescreen) mit ihrer E-Mail aktivieren, bevor sie sich anmelden können.
          </p>
        </form>
      </section>

      {/* Bestehende Mitglieder */}
      <section className="section">
        <h2 className="section-title">Mitglieder ({mitglieder.length})</h2>
        <ul className="stack">
          {mitglieder.map((m) => (
            <li key={m.mitgliedId} className="card">
              <MitgliedVerwalten
                mitglied={m}
                tarife={tarife.map((t) => ({ tarifId: t.tarifId, name: t.name }))}
                aktiviert={aktiviertSet.has(m.mitgliedId)}
              />
            </li>
          ))}
          {mitglieder.length === 0 && <li className="empty">Noch keine Mitglieder.</li>}
        </ul>
      </section>
    </main>
  );
}
