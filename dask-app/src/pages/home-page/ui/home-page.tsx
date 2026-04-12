import { Link } from "react-router-dom";
import { routePaths } from "@/app/router";
import daskLogoFull from "@/shared/assets/dask-logo-full.svg";
import "./home-page.css";

export function HomePage() {
  return (
    <main className="home-page">
      <section className="home-page__hero" aria-label="Tela inicial da plataforma">
        <img className="home-page__logo" src={daskLogoFull} alt="Logo Dask" />
        <p className="home-page__eyebrow">Gestao operacional inteligente</p>
        <h1 className="home-page__title">Acompanhe a operacao do seu time com foco no que importa.</h1>
        <p className="home-page__description">
          Organize tarefas, acompanhe entregas e mantenha sua equipe alinhada em um fluxo unico.
        </p>

        <div className="home-page__actions">
          <Link className="home-page__action home-page__action--primary" to={routePaths.login}>
            Entrar na plataforma
          </Link>
        </div>
      </section>
    </main>
  );
}
