import { LoginForm } from "@/features/auth";
import "./login-page.css";

export function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-page__backdrop" />
      <LoginForm />
    </main>
  );
}
