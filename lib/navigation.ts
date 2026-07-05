import type { Rolle } from "@/lib/auth/benutzer";

// Explizite, geordnete Seiten-Reihenfolge je Rolle für die Vor/Zurück-Navigation.
// Nutzt exakt die bestehenden Routen-Ziele (keine neuen Routen); dient nur der
// deterministischen Reihenfolge der Buttons — unabhängig von der Browser-History.
export function seitenReihenfolge(rolle: Rolle | null): string[] {
  switch (rolle) {
    case "admin":
      return [
        "/",
        "/admin/mitglieder",
        "/admin/kurstermine",
        "/admin/nachweis",
        "/admin/no-show",
        "/admin/kurstypen",
      ];
    case "trainer":
      return ["/", "/trainer"];
    case "mitglied":
      return ["/", "/kurse", "/mein-bereich", "/videos"];
    default:
      return ["/", "/login"];
  }
}
