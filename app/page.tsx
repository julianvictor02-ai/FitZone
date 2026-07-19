import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { getBenutzer } from "@/lib/auth/benutzer";
import { logout } from "./login/actions";
import {
  Users,
  Calendar,
  ClipboardList,
  CheckCircle,
  CreditCard,
  Euro,
  Dumbbell,
  User,
  Video,
  LogIn,
} from "@/components/icons";

type NavItem = { href: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> };

// Navigations-Ziele je Rolle (Labels/Hrefs unverändert gegenüber vorher).
const NAV: Record<string, NavItem[]> = {
  admin: [
    { href: "/admin/mitglieder", label: "Mitglieder-Verwaltung", icon: Users },
    { href: "/admin/kurstermine", label: "Kurstermin-Verwaltung", icon: Calendar },
    { href: "/admin/nachweis", label: "Buchungsnachweis", icon: ClipboardList },
    { href: "/admin/no-show", label: "No-Show-Auswertung", icon: CheckCircle },
    { href: "/admin/storno", label: "Storno-Gebühren", icon: Euro },
    { href: "/admin/kurstypen", label: "Kurspreise", icon: CreditCard },
    { href: "/admin/videos", label: "Videos verwalten", icon: Video },
  ],
  trainer: [{ href: "/trainer", label: "Mein Kursplan", icon: Calendar }],
  mitglied: [
    { href: "/kurse", label: "Kurse buchen", icon: Dumbbell },
    { href: "/mein-bereich", label: "Mein Bereich", icon: User },
    { href: "/videos", label: "Videos", icon: Video },
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
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <Link key={l.href} href={l.href} className="navlink">
                  <span className="icon-tile" style={{ width: 36, height: 36 }}>
                    <Icon />
                  </span>
                  <span className="navlink-label">{l.label}</span>
                </Link>
              );
            })}
          </nav>

          <form action={logout}>
            <button type="submit" className="btn btn-outline btn-block">
              Abmelden
            </button>
          </form>
        </div>
      ) : (
        <Link href="/login" className="btn btn-primary btn-block">
          <LogIn /> Anmelden
        </Link>
      )}
    </main>
  );
}
