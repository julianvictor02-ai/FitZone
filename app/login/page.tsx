import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  // Reduzierter, zentrierter Login-Screen. Branding, Baum-Feedback und Formular
  // stecken in der Client-Component LoginForm (State: Baum reagiert aufs Ergebnis).
  return (
    <main className="page login">
      <LoginForm />
    </main>
  );
}
