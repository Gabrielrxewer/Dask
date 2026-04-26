import { Link, useParams } from "react-router-dom";
import { routePaths } from "@/app/router";
import "./proposal-public-page.css";

export function ProposalPublicPage() {
  const { token = "" } = useParams<{ token: string }>();
  const visibleToken = token ? `${token.slice(0, 8)}...` : "sem token";

  return (
    <main className="proposal-public-page">
      <section className="proposal-public-page__panel">
        <span>Proposta comercial</span>
        <h1>Link publico preparado</h1>
        <p>Token: {visibleToken}</p>
        <div className="proposal-public-page__actions">
          <Link className="proposal-public-page__button" to={routePaths.home}>Voltar ao Dask</Link>
        </div>
      </section>
    </main>
  );
}
