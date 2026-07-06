import { Dumbbell } from "@/components/icons";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const { fehler } = await searchParams;

  return (
    <main className="page login">
      {/* Branding – bewusst reduziert, klarer Fokus auf die Anmeldung */}
      <div className="brandmark">
        <span className="brand-logo" aria-hidden="true">
          <Dumbbell />
        </span>
        <div>
          <h1 className="page-title">FitZone</h1>
          <p className="subtitle">Willkommen zurück – melde dich an.</p>
        </div>
      </div>

      <LoginForm fehler={Boolean(fehler)} />
    </main>
  );
}
