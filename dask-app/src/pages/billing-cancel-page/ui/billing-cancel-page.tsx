import { Link } from "react-router-dom";
import { routePaths } from "@/app/router";
import "./billing-cancel-page.css";

export function BillingCancelPage() {
  return (
    <main className="billing-cancel">
      <div className="billing-cancel__icon">×</div>
      <h1 className="billing-cancel__title">Pagamento nao concluido</h1>
      <p className="billing-cancel__description">
        Voce cancelou o processo de pagamento. Nenhuma cobranca foi realizada. Escolha um plano quando estiver
        pronto.
      </p>
      <div className="billing-cancel__actions">
        <Link className="billing-cancel__btn billing-cancel__btn--primary" to={routePaths.choosePlan}>
          Ver planos novamente
        </Link>
        <Link className="billing-cancel__btn billing-cancel__btn--secondary" to={routePaths.home}>
          Voltar ao inicio
        </Link>
      </div>
    </main>
  );
}
