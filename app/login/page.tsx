import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ aktiviert?: string }>;
}) {
  // Reduzierter, zentrierter Login-Screen. Branding, Baum-Feedback und Formular
  // stecken in der Client-Component LoginForm (State: Baum reagiert aufs Ergebnis).
  const { aktiviert } = await searchParams;
  return (
    <main className="page login">
      <LoginForm aktiviert={aktiviert === "1"} />
    </main>
  );
}
