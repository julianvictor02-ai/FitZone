"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Home } from "@/components/icons";

// Untere Navigation: genau zwei Buttons.
//   • „Zurück" (links)  → echter History-Schritt zurück (router.back()), nicht Pager.
//   • „Home"  (rechts) → fest auf die Root-Route „/" (rollenspezifischer Hauptaktions-Hub).
// Der frühere Vorwärts-Pfeil samt Pager-Index-Logik ist entfernt.
//
// „Zurück" ist deaktiviert, wenn es in DIESER App-Session keine vorherige Seite gibt.
// Dafür führen wir eine In-App-Navigationstiefe in sessionStorage (unabhängig von
// externen History-Einträgen wie einer zuvor besuchten fremden Seite).

const STACK_KEY = "fz_nav_stack";

export function SeitenNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [canBack, setCanBack] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Auf dem Login-Screen die In-App-History zurücksetzen: nach dem Login soll
    // „/" die Wurzel sein (kein „Zurück" auf den Anmeldescreen).
    if (pathname === "/login") {
      sessionStorage.setItem(STACK_KEY, "[]");
      setCanBack(false);
      return;
    }

    let stack: string[] = [];
    try {
      stack = JSON.parse(sessionStorage.getItem(STACK_KEY) ?? "[]");
    } catch {
      stack = [];
    }

    const top = stack[stack.length - 1];
    if (top === pathname) {
      // Reload / doppelter Effekt-Lauf – unverändert lassen (idempotent).
    } else if (stack[stack.length - 2] === pathname) {
      stack.pop(); // Nutzer ist einen Schritt zurückgegangen.
    } else {
      stack.push(pathname); // Vorwärts-Navigation.
    }

    sessionStorage.setItem(STACK_KEY, JSON.stringify(stack));
    setCanBack(stack.length > 1);
  }, [pathname]);

  // Auf dem Anmeldescreen keine Navigation anzeigen.
  if (pathname === "/login") return null;

  return (
    <nav aria-label="Navigation">
      <button
        type="button"
        className="nav-fab nav-fab-left"
        aria-label="Zurück"
        disabled={!canBack}
        onClick={() => router.back()}
      >
        <ChevronLeft />
      </button>
      <Link href="/" className="nav-fab nav-fab-right" aria-label="Home">
        <Home />
      </Link>
    </nav>
  );
}
