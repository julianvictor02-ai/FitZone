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
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold">Mitglieder-Verwaltung</h1>
      <p className="mt-1 text-sm text-gray-500">
        Stammdaten, Tarif und Status — nur durch Admin pflegbar (FZ-006).
      </p>

      {/* Neues Mitglied */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Neues Mitglied</h2>
        <form
          action={erstelleMitglied}
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input name="name" required className="rounded border border-gray-300 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            E-Mail
            <input
              type="email"
              name="email"
              required
              className="rounded border border-gray-300 px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Tarif
            <select name="tarifId" required className="rounded border border-gray-300 px-2 py-1">
              {tarife.map((t) => (
                <option key={t.tarifId} value={t.tarifId}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Mitgliedschaft bis
            <input
              type="date"
              name="mitgliedschaftBis"
              className="rounded border border-gray-300 px-2 py-1"
            />
          </label>
          <button type="submit" className="rounded bg-black px-4 py-2 text-sm text-white">
            Anlegen
          </button>
        </form>
      </section>

      {/* Bestehende Mitglieder */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          Mitglieder ({mitglieder.length})
        </h2>
        <ul className="mt-3 divide-y divide-gray-200">
          {mitglieder.map((m) => (
            <li key={m.mitgliedId} className="py-3">
              <div className="font-medium">{m.name}</div>
              <div className="text-sm text-gray-500">{m.email}</div>
              <form
                action={aktualisiereMitglied}
                className="mt-2 flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="mitgliedId" value={m.mitgliedId} />
                <label className="flex flex-col gap-1 text-xs">
                  Tarif
                  <select
                    name="tarifId"
                    defaultValue={m.tarifId}
                    className="rounded border border-gray-300 px-2 py-1"
                  >
                    {tarife.map((t) => (
                      <option key={t.tarifId} value={t.tarifId}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  Status
                  <select
                    name="status"
                    defaultValue={m.status}
                    className="rounded border border-gray-300 px-2 py-1"
                  >
                    <option value="aktiv">aktiv</option>
                    <option value="pausiert">pausiert</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="rounded border border-gray-400 px-3 py-1 text-xs"
                >
                  Speichern
                </button>
              </form>
            </li>
          ))}
          {mitglieder.length === 0 && (
            <li className="py-3 text-sm text-gray-500">Noch keine Mitglieder.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
