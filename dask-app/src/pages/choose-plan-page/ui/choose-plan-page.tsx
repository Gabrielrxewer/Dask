import { useState } from "react";
import { billingService, PLAN_DISPLAY } from "@/modules/billing";
import type { SubscriptionPlan } from "@/modules/billing";
import "./choose-plan-page.css";

const PLAN_FEATURES: Record<SubscriptionPlan, string[]> = {
  PERSONAL: [
    "1 workspace pessoal",
    "Boards, listas e timeline",
    "IA para melhorias",
    "Automacoes basicas",
    "Busca semantica"
  ],
  BUSINESS: [
    "Multiplos workspaces",
    "Suporte a equipes",
    "Boards, listas e timeline",
    "IA avancada e automacoes",
    "Campos personalizados",
    "Auditoria e integracoes",
    "Suporte prioritario"
  ]
};

export function ChoosePlanPage() {
  const [loadingPlan, setLoadingPlan] = useState<SubscriptionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChoosePlan(plan: SubscriptionPlan) {
    setLoadingPlan(plan);
    setError(null);

    try {
      const { url } = await billingService.createCheckoutSession(plan);
      window.location.href = url;
    } catch {
      setError("Nao foi possivel iniciar o pagamento. Tente novamente.");
      setLoadingPlan(null);
    }
  }

  return (
    <main className="choose-plan">
      <header className="choose-plan__header">
        <p className="choose-plan__eyebrow">Planos e precos</p>
        <h1 className="choose-plan__title">Escolha o plano ideal para você</h1>
        <p className="choose-plan__description">
          Acesso completo a plataforma apos a confirmacao do pagamento. Cobranca mensal recorrente, cancele quando
          quiser.
        </p>
      </header>

      <div className="choose-plan__plans">
        <article className="choose-plan__card">
          <p className="choose-plan__plan-name">{PLAN_DISPLAY.PERSONAL.name}</p>
          <div className="choose-plan__price">
            <span className="choose-plan__price-value">{PLAN_DISPLAY.PERSONAL.price}</span>
            <span className="choose-plan__price-period">/mes</span>
          </div>
          <p className="choose-plan__plan-description">{PLAN_DISPLAY.PERSONAL.description}</p>
          <ul className="choose-plan__features">
            {PLAN_FEATURES.PERSONAL.map((f) => (
              <li key={f} className="choose-plan__feature">{f}</li>
            ))}
          </ul>
          <button
            className={`choose-plan__action${loadingPlan === "PERSONAL" ? " choose-plan__action--loading" : ""}`}
            disabled={loadingPlan !== null}
            onClick={() => handleChoosePlan("PERSONAL")}
            type="button"
          >
            {loadingPlan === "PERSONAL" ? "Aguarde..." : "Assinar Pessoal"}
          </button>
        </article>

        <article className="choose-plan__card choose-plan__card--featured">
          <span className="choose-plan__badge">Popular</span>
          <p className="choose-plan__plan-name">{PLAN_DISPLAY.BUSINESS.name}</p>
          <div className="choose-plan__price">
            <span className="choose-plan__price-value">{PLAN_DISPLAY.BUSINESS.price}</span>
            <span className="choose-plan__price-period">/mes</span>
          </div>
          <p className="choose-plan__plan-description">{PLAN_DISPLAY.BUSINESS.description}</p>
          <ul className="choose-plan__features">
            {PLAN_FEATURES.BUSINESS.map((f) => (
              <li key={f} className="choose-plan__feature">{f}</li>
            ))}
          </ul>
          <button
            className={`choose-plan__action${loadingPlan === "BUSINESS" ? " choose-plan__action--loading" : ""}`}
            disabled={loadingPlan !== null}
            onClick={() => handleChoosePlan("BUSINESS")}
            type="button"
          >
            {loadingPlan === "BUSINESS" ? "Aguarde..." : "Assinar Business"}
          </button>
        </article>
      </div>

      {error && <p className="choose-plan__error">{error}</p>}

      <p className="choose-plan__notice">
        O acesso e liberado automaticamente apos a confirmacao do pagamento pelo Stripe. Nenhum dado de cartao e
        armazenado pelo Dask.
      </p>
    </main>
  );
}
