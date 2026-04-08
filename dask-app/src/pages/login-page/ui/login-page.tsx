import daskLogoFull from "@/shared/assets/dask-logo-full.svg";
import { LoginForm } from "@/features/auth";
import "./login-page.css";

export function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-page__backdrop" aria-hidden="true" />

      <div className="login-page__shell">
        <section className="login-page__brand" aria-label="Apresentacao da plataforma">
          <div className="login-page__brand-motion" aria-hidden="true">
            <span className="login-page__orb login-page__orb--one" />
            <span className="login-page__orb login-page__orb--two" />
            <span className="login-page__orb login-page__orb--three" />
            <span className="login-page__signal login-page__signal--one" />
            <span className="login-page__signal login-page__signal--two" />
          </div>

          <img className="login-page__logo" src={daskLogoFull} alt="Logo Dask" />
          <h2 className="login-page__title">Mais clareza e controle para a operacao industrial.</h2>
          <p className="login-page__subtitle">
            Centralize atividades, acompanhe prioridades e mantenha sua equipe alinhada em uma interface moderna,
            objetiva e facil de retomar.
          </p>

          <div className="login-page__feature-list">
            <p className="login-page__feature">Fluxo pensado para a rotina operacional, sem excesso visual.</p>
            <p className="login-page__feature">Acesso rapido as prioridades, informacoes e contexto.</p>
          </div>
        </section>

        <div className="login-page__form-column">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
