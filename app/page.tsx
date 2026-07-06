import Link from "next/link";
import { getBenutzer } from "@/lib/auth/benutzer";
import { logout } from "./login/actions";

// Navigations-Ziele je Rolle (Labels/Hrefs unverändert gegenüber vorher).
const NAV: Record<string, { href: string; label: string }[]> = {
  admin: [
    { href: "/admin/mitglieder", label: "Mitglieder-Verwaltung" },
    { href: "/admin/kurstermine", label: "Kurstermin-Verwaltung" },
    { href: "/admin/nachweis", label: "Buchungsnachweis" },
    { href: "/admin/no-show", label: "No-Show-Auswertung" },
    { href: "/admin/kurstypen", label: "Kurspreise" },
  ],
  trainer: [{ href: "/trainer", label: "Mein Kursplan" }],
  mitglied: [
    { href: "/kurse", label: "Kurse buchen" },
    { href: "/mein-bereich", label: "Mein Bereich" },
    { href: "/videos", label: "Videos" },
  ],
};

export default async function Home() {
  const benutzer = await getBenutzer();
  const links = benutzer ? NAV[benutzer.rolle] ?? [] : [];

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">FitZone</h1>
        <p className="subtitle">
          Kursbuchung, Warteliste und Anwesenheit für das FitZone-Studio.
        </p>
      </header>

      {benutzer ? (
        <div className="flex flex-col gap-4">
          <div className="card">
            <p className="text-sm text-muted">Angemeldet als</p>
            <p className="mt-0.5 font-medium text-ink break-all">{benutzer.email}</p>
            <span className="badge badge-success mt-2">{benutzer.rolle}</span>
          </div>

          <nav className="stack">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="navlink">
                {l.label}
              </Link>
            ))}
          </nav>

          <form action={logout}>
            <button type="submit" className="btn btn-outline btn-block">
              Abmelden
            </button>
          </form>
        </div>
      ) : (
        <Link href="/login" className="btn btn-primary btn-block">
          Anmelden
        </Link>
      )}
    </main>
  );
}
