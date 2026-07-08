import { AktivierenForm } from "./AktivierenForm";

export default function AktivierenPage() {
  // Zentrierter Screen im Login-Look. Untere Navigation (Zurück/Home) rendert nur für
  // angemeldete Nutzer (siehe layout.tsx) — hier also unsichtbar wie beim Login.
  return (
    <main className="page login">
      <AktivierenForm />
    </main>
  );
}
