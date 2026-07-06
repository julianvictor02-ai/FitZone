import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const { fehler } = await searchParams;

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Anmelden</h1>
        <p className="subtitle">Melde dich mit deiner FitZone-Zugangsdaten an.</p>
      </header>
      {fehler && (
        <p className="mb-4 rounded-btn bg-red-50 px-3 py-2 text-sm text-red-700">
          Anmeldung fehlgeschlagen. E-Mail oder Passwort prüfen.
        </p>
      )}
      <form action={login} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          E-Mail
          <input type="email" name="email" required autoComplete="email" className="input" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Passwort
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="input"
          />
        </label>
        <button type="submit" className="btn btn-primary btn-block mt-1">
          Anmelden
        </button>
      </form>
    </main>
  );
}
