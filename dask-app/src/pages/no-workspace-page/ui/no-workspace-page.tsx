import { Link } from "react-router-dom";
import { routePaths } from "@/app/router";
import { Card, StatusBadge } from "@/shared/ui";
import daskLogoFull from "@/shared/assets/dask-logo-full.svg";
import "./no-workspace-page.css";

export function NoWorkspacePage() {
  return (
    <main className="no-workspace-page">
      <div className="no-workspace-page__backdrop" aria-hidden="true" />

      <section className="no-workspace-page__shell" aria-label="Nenhum workspace disponivel">
        <div className="no-workspace-page__copy">
          <img className="no-workspace-page__logo" src={daskLogoFull} alt="Logo Dask" />
          <p className="no-workspace-page__eyebrow">Workspace indisponivel</p>
          <h1 className="no-workspace-page__title">Nao encontramos um workspace disponivel para esta conta.</h1>
          <p className="no-workspace-page__description">
            O acesso ao Dask depende de pelo menos um workspace associado ao usuario. Se voce acabou de entrar, tente
            novamente em instantes ou confira com o administrador da operacao.
          </p>

          <div className="no-workspace-page__actions">
            <Link className="no-workspace-page__action no-workspace-page__action--primary" to={routePaths.workspaceEntry}>
              Tentar novamente
            </Link>
            <Link className="no-workspace-page__action no-workspace-page__action--secondary" to={routePaths.home}>
              Ver home do produto
            </Link>
          </div>
        </div>

        <Card className="no-workspace-page__side-card">
          <div className="no-workspace-page__card-head">
            <span className="no-workspace-page__card-label">Estado atual</span>
            <StatusBadge tone="warning">Sem workspace</StatusBadge>
          </div>

          <div className="no-workspace-page__signals">
            <article className="no-workspace-page__signal">
              <strong>Conta autenticada</strong>
              <p>O login foi concluido, mas nao existe um workspace acessivel para carregar a operacao.</p>
            </article>

            <article className="no-workspace-page__signal">
              <strong>Fluxo esperado</strong>
              <p>Assim que houver um workspace disponivel, o redirecionamento para board, lista ou timeline volta a funcionar.</p>
            </article>

            <article className="no-workspace-page__signal">
              <strong>Proximo passo</strong>
              <p>Se isso nao deveria acontecer, valide vinculacao, permissao ou provisionamento do workspace.</p>
            </article>
          </div>
        </Card>
      </section>
    </main>
  );
}
