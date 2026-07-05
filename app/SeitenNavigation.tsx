"use client";

import { usePathname, useRouter } from "next/navigation";

// Minimalistische Vor/Zurück-Navigation (nur Chevrons), fix unten links/rechts.
// Navigiert deterministisch entlang der übergebenen, geordneten Seiten-Liste –
// nicht über die Browser-Forward-History. An den Enden ist der jeweilige Button
// deaktiviert.
export function SeitenNavigation({ seiten }: { seiten: string[] }) {
  const pathname = usePathname();
  const router = useRouter();

  const idx = seiten.indexOf(pathname);
  const zurueck = idx > 0 ? seiten[idx - 1] : null;
  const vor = idx >= 0 && idx < seiten.length - 1 ? seiten[idx + 1] : null;

  return (
    <nav aria-label="Seiten-Navigation">
      <button
        type="button"
        className="nav-fab nav-fab-left"
        aria-label="Zurück"
        disabled={!zurueck}
        onClick={() => zurueck && router.push(zurueck)}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <button
        type="button"
        className="nav-fab nav-fab-right"
        aria-label="Weiter"
        disabled={!vor}
        onClick={() => vor && router.push(vor)}
      >
        <span aria-hidden="true">›</span>
      </button>
    </nav>
  );
}
