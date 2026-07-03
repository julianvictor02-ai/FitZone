import Link from "next/link";
import { getBenutzer } from "@/lib/auth/benutzer";
import { logout } from "./login/actions";

export default async function Home() {
  const benutzer = await getBenutzer();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold">FitZone</h1>
      <p className="mt-2 text-gray-600">
        Kursbuchung, Warteliste und Anwesenheit für das FitZone-Studio.
      </p>

      <div className="mt-8">
        {benutzer ? (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              Angemeldet als <strong>{benutzer.email}</strong> ({benutzer.rolle})
            </span>
            {benutzer.rolle === "admin" && (
              <Link href="/admin/mitglieder" className="underline">
                Mitglieder-Verwaltung
              </Link>
            )}
            <form action={logout}>
              <button type="submit" className="underline">
                Abmelden
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded bg-black px-4 py-2 text-sm text-white"
          >
            Anmelden
          </Link>
        )}
      </div>

      <p className="mt-10 text-sm text-gray-500">
        Aktueller Stand: FZ-006 (Auth + Mitgliederstammdaten). Nächster Schritt laut{" "}
        <code>docs/backlog.md</code>: Buchungs-UI für FZ-001.
      </p>
    </main>
  );
}
