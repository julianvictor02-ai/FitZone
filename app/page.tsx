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
      <header className="pt-1">
        <h1 className="text-2xl font-bold text-ink">FitZone</h1>
        <p className="mt-1 text-sm text-muted">
          Kursbuchung, Warteliste und Anwesenheit für das FitZone-Studio.
        </p>
      </header>

      {benutzer ? (
        <div className="mt-6 flex flex-col gap-4">
          <div className="card">
            <p className="text-sm text-muted">Angemeldet als</p>
            <p className="mt-0.5 font-medium text-ink break-all">{benutzer.email}</p>
            <span className="mt-2 inline-block rounded-full border border-surface-border bg-white px-2.5 py-0.5 text-xs font-medium text-brand-strong">
              {benutzer.rolle}
            </span>
          </div>

          <nav className="flex flex-col gap-2">
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
        <div className="mt-6">
          <Link href="/login" className="btn btn-primary btn-block">
            Anmelden
          </Link>
        </div>
      )}

      <p className="mt-8 text-xs text-muted">
        Aktueller Stand: Kursbuchung/Warteliste/Storno (FZ-001–003), Auth +
        Mitgliederstammdaten (FZ-006) und Trainer-Anwesenheit (FZ-004/005). Details in{" "}
        <code>docs/backlog.md</code>.
      </p>
    </main>
  );
}
