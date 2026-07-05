import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const { fehler } = await searchParams;

  return (
    <main className="page">
      <h1 className="text-2xl font-bold text-ink">Anmelden</h1>
      {fehler && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          Anmeldung fehlgeschlagen. E-Mail oder Passwort prüfen.
        </p>
      )}
      <form action={login} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          E-Mail
          <input
            type="email"
            name="email"
            required
            className="min-h-11 rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Passwort
          <input
            type="password"
            name="password"
            required
            className="min-h-11 rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <button type="submit" className="btn btn-primary btn-block mt-2">
          Anmelden
        </button>
      </form>
    </main>
  );
}
