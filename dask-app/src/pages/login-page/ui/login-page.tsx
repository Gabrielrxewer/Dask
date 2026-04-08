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

          <p className="login-page__eyebrow">Dask Platform</p>
          <h2 className="login-page__title">Operacao industrial com clareza e controle.</h2>
          <p className="login-page__subtitle">
            Centralize atividades, acompanhe prioridades e mantenha o time alinhado em uma interface objetiva,
            profissional e facil de retomar.
          </p>

          <div className="login-page__highlights" aria-hidden="true">
            <article className="login-page__highlight-card">
              <span className="login-page__highlight-label">Fluxo organizado</span>
              <strong className="login-page__highlight-value">Planejamento e execucao em uma visao consistente</strong>
            </article>

            <article className="login-page__highlight-card">
              <span className="login-page__highlight-label">Contexto rapido</span>
              <strong className="login-page__highlight-value">Prioridades, responsaveis e status com leitura imediata</strong>
            </article>
          </div>

          <div className="login-page__feature-list">
            <p className="login-page__feature">Ambiente desenhado para operacao diaria, sem excesso visual.</p>
            <p className="login-page__feature">Experiencia objetiva para acesso rapido e retomada de contexto.</p>
          </div>
        </section>

        <div className="login-page__form-column">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
