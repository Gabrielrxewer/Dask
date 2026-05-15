import { Link } from "react-router-dom";
import { routePaths } from "@/app/router";
import { useBilling } from "@/modules/billing";
import "./subscription-blocked-page.css";

const STATUS_MESSAGES: Record<string, string> = {
  PAST_DUE: "Pagamento pendente - atualize seu metodo de pagamento.",
  CANCELED: "Assinatura cancelada.",
  UNPAID: "Pagamento nao realizado.",
  INCOMPLETE: "Pagamento incompleto.",
  INCOMPLETE_EXPIRED: "Sessao de pagamento expirada."
};

export function SubscriptionBlockedPage() {
  const billing = useBilling();
  const status = billing.status?.status ?? null;
  const message = status ? (STATUS_MESSAGES[status] ?? null) : null;

  return (
    <main className="subscription-blocked">
      <section className="subscription-blocked__panel" aria-labelledby="subscription-blocked-title">
        <div className="subscription-blocked__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 id="subscription-blocked-title" className="subscription-blocked__title">Assinatura necessaria</h1>
        <p className="subscription-blocked__description">
          {billing.status?.message ?? "Voce precisa de uma assinatura ativa para acessar a plataforma."}
        </p>
        {message && <p className="subscription-blocked__status">{message}</p>}
        <div className="subscription-blocked__actions">
          <Link className="subscription-blocked__btn subscription-blocked__btn--primary" to={routePaths.choosePlan}>
            Ver planos
          </Link>
          <Link className="subscription-blocked__btn subscription-blocked__btn--secondary" to={routePaths.home}>
            Voltar ao inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
