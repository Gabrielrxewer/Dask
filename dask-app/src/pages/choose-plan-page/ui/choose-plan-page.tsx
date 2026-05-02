import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { routePaths } from "@/app/router";
import { billingService, PLAN_DISPLAY } from "@/modules/billing";
import type { BillingStatus, SubscriptionPlan } from "@/modules/billing";
import "./choose-plan-page.css";

const PLAN_FEATURES: Record<SubscriptionPlan, string[]> = {
  PERSONAL: [
    "1 workspace pessoal",
    "Boards, listas e agenda",
    "IA para melhorias",
    "Automações básicas",
    "Busca semântica"
  ],
  BUSINESS: [
    "Múltiplos workspaces",
    "Suporte a equipes",
    "Boards, listas e agenda",
    "IA avançada e automações",
    "Campos personalizados",
    "Auditoria e integrações",
    "Suporte prioritário"
  ]
};

export function ChoosePlanPage() {
  const [loadingPlan, setLoadingPlan] = useState<SubscriptionPlan | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<BillingStatus | null>(null);

  useEffect(() => {
    let mounted = true;

    billingService
      .getStatus()
      .then((value) => {
        if (!mounted) return;
        setStatus(value);
      })
      .catch(() => {
        if (!mounted) return;
        setStatus(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (!status?.status) {
      return "Sem assinatura ativa";
    }

    const labels: Record<string, string> = {
      ACTIVE: "Ativa",
      TRIALING: "Em período de teste",
      PAST_DUE: "Pagamento pendente",
      CANCELED: "Cancelada",
      UNPAID: "Não paga",
      INCOMPLETE: "Incompleta",
      INCOMPLETE_EXPIRED: "Expirada",
      PAUSED: "Pausada"
    };

    return labels[status.status] ?? status.status;
  }, [status?.status]);

  async function handleChoosePlan(plan: SubscriptionPlan) {
    setLoadingPlan(plan);
    setError(null);

    try {
      const { url } = await billingService.createCheckoutSession(plan);
      window.location.href = url;
    } catch {
      setError("Não foi possível iniciar o pagamento. Tente novamente.");
      setLoadingPlan(null);
    }
  }

  async function handleOpenPortal() {
    if (isOpeningPortal) {
      return;
    }

    setError(null);
    setIsOpeningPortal(true);
    try {
      const { url } = await billingService.createPortalSession();
      window.location.href = url;
    } catch {
      setError("Não foi possível abrir a gestão da assinatura. Tente novamente.");
      setIsOpeningPortal(false);
    }
  }

  const currentPlan = status?.plan ? PLAN_DISPLAY[status.plan] : null;
  const periodEndLabel = status?.currentPeriodEnd ? new Date(status.currentPeriodEnd).toLocaleDateString("pt-BR") : "Nao disponivel";

  return (
    <main className="choose-plan">
      <section className="choose-plan__intro">
        <header className="choose-plan__header">
          <p className="choose-plan__eyebrow">Planos e precos</p>
          <h1 className="choose-plan__title">Escolha o plano ideal para voce</h1>
          <p className="choose-plan__description choose-plan__description--legal">
            Antes de pagar, revise os <Link to={routePaths.termsOfUse}>Termos de Uso</Link> e a{" "}
            <Link to={routePaths.privacyPolicy}>Política de Privacidade</Link>. Ao clicar em "Assinar", você concorda
            com ambos.
          </p>
        </header>
      </section>

      {status ? (
        <section className="choose-plan__current-subscription" aria-label="Resumo da assinatura atual">
          <div className="choose-plan__current-subscription-copy">
            <p className="choose-plan__current-subscription-eyebrow">Assinatura atual</p>
            <h2>{currentPlan ? `${currentPlan.name} (${currentPlan.price}/mes)` : "Sem plano ativo"}</h2>
            <p>
              Status: <strong>{statusLabel}</strong> · Próxima renovação: <strong>{periodEndLabel}</strong>
            </p>
            {status.cancelAtPeriodEnd ? (
              <p className="choose-plan__cancel-note">
                Cancelamento já agendado para o fim do ciclo atual. Você pode reativar pela área de gestão da
                assinatura.
              </p>
            ) : null}
          </div>
          <button
            className="choose-plan__portal-btn"
            type="button"
            onClick={() => void handleOpenPortal()}
            disabled={isOpeningPortal}
          >
            {isOpeningPortal ? "Abrindo gestão..." : "Gerenciar assinatura / cancelar"}
          </button>
        </section>
      ) : null}

      <div className="choose-plan__plans">
        <article className="choose-plan__card">
          <p className="choose-plan__plan-name">{PLAN_DISPLAY.PERSONAL.name}</p>
          <div className="choose-plan__price">
            <span className="choose-plan__price-value">{PLAN_DISPLAY.PERSONAL.price}</span>
            <span className="choose-plan__price-period">/mes</span>
          </div>
          <p className="choose-plan__plan-description">{PLAN_DISPLAY.PERSONAL.description}</p>
          <ul className="choose-plan__features">
            {PLAN_FEATURES.PERSONAL.map((feature) => (
              <li key={feature} className="choose-plan__feature">
                {feature}
              </li>
            ))}
          </ul>
          <button
            className={`choose-plan__action${loadingPlan === "PERSONAL" ? " choose-plan__action--loading" : ""}`}
            disabled={loadingPlan !== null || status?.plan === "PERSONAL"}
            onClick={() => handleChoosePlan("PERSONAL")}
            type="button"
          >
            {status?.plan === "PERSONAL" ? "Plano atual" : loadingPlan === "PERSONAL" ? "Aguarde..." : "Assinar Pessoal"}
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
            {PLAN_FEATURES.BUSINESS.map((feature) => (
              <li key={feature} className="choose-plan__feature">
                {feature}
              </li>
            ))}
          </ul>
          <button
            className={`choose-plan__action${loadingPlan === "BUSINESS" ? " choose-plan__action--loading" : ""}`}
            disabled={loadingPlan !== null || status?.plan === "BUSINESS"}
            onClick={() => handleChoosePlan("BUSINESS")}
            type="button"
          >
            {status?.plan === "BUSINESS" ? "Plano atual" : loadingPlan === "BUSINESS" ? "Aguarde..." : "Assinar Business"}
          </button>
        </article>
      </div>

      <div className="choose-plan__footer">
        {error && <p className="choose-plan__error">{error}</p>}

        <p className="choose-plan__notice choose-plan__notice--summary">
          Acesso completo à plataforma após a confirmação do pagamento. Cobrança mensal recorrente, cancele quando
          quiser.
        </p>

        <p className="choose-plan__notice">
          Pagamento processado com segurança via Stripe. Nenhum dado de cartão é armazenado pelo Dask.
        </p>
      </div>
    </main>
  );
}
