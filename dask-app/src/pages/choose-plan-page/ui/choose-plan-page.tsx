import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { routePaths } from "@/app/router";
import { billingService } from "@/modules/billing";
import type { BillingPlan, BillingStatus, SubscriptionPlan } from "@/modules/billing";
import "./choose-plan-page.css";

function formatPlanPrice(plan: BillingPlan): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: plan.currency.toUpperCase()
  }).format(plan.amount / 100);
}

function formatPlanPeriod(plan: BillingPlan): string {
  if (plan.interval === "month") return "/mes";
  if (plan.interval === "year") return "/ano";
  if (plan.interval) return `/${plan.interval}`;
  return "";
}

export function ChoosePlanPage() {
  const [loadingPlan, setLoadingPlan] = useState<SubscriptionPlan | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);

  useEffect(() => {
    let mounted = true;

    Promise.all([billingService.getStatus(), billingService.listPlans()])
      .then(([statusValue, planCatalog]) => {
        if (!mounted) return;
        setStatus(statusValue);
        setPlans(
          planCatalog.items
            .filter((plan) => plan.isActive)
        );
      })
      .catch(() => {
        if (!mounted) return;
        setStatus(null);
        setPlans([]);
        setError("Nao foi possivel carregar os planos configurados.");
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoadingPlans(false);
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
      TRIALING: "Em periodo de teste",
      PAST_DUE: "Pagamento pendente",
      CANCELED: "Cancelada",
      UNPAID: "Nao paga",
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
      setError("Nao foi possivel iniciar o pagamento. Tente novamente.");
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
      setError("Nao foi possivel abrir a gestao da assinatura. Tente novamente.");
      setIsOpeningPortal(false);
    }
  }

  const currentPlan = status?.plan ? plans.find((plan) => plan.code === status.plan) ?? null : null;
  const periodEndLabel = status?.currentPeriodEnd ? new Date(status.currentPeriodEnd).toLocaleDateString("pt-BR") : "Nao disponivel";

  return (
    <main className="choose-plan">
      <section className="choose-plan__intro">
        <header className="choose-plan__header">
          <p className="choose-plan__eyebrow">Planos e precos</p>
          <h1 className="choose-plan__title">Escolha o plano ideal para voce</h1>
          <p className="choose-plan__description choose-plan__description--legal">
            Antes de pagar, revise os <Link to={routePaths.termsOfUse}>Termos de Uso</Link> e a{" "}
            <Link to={routePaths.privacyPolicy}>Politica de Privacidade</Link>. Ao clicar em "Assinar", voce concorda
            com ambos.
          </p>
        </header>
      </section>

      {status ? (
        <section className="choose-plan__current-subscription" aria-label="Resumo da assinatura atual">
          <div className="choose-plan__current-subscription-copy">
            <p className="choose-plan__current-subscription-eyebrow">Assinatura atual</p>
            <h2>{currentPlan ? `${currentPlan.name} (${formatPlanPrice(currentPlan)}${formatPlanPeriod(currentPlan)})` : "Sem plano ativo"}</h2>
            <p>
              Status: <strong>{statusLabel}</strong> - Proxima renovacao: <strong>{periodEndLabel}</strong>
            </p>
            {status.cancelAtPeriodEnd ? (
              <p className="choose-plan__cancel-note">
                Cancelamento ja agendado para o fim do ciclo atual. Voce pode reativar pela area de gestao da
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
            {isOpeningPortal ? "Abrindo gestao..." : "Gerenciar assinatura / cancelar"}
          </button>
        </section>
      ) : null}

      <div className="choose-plan__plans">
        {isLoadingPlans ? (
          <article className="choose-plan__card">
            <p className="choose-plan__plan-name">Carregando planos...</p>
          </article>
        ) : null}

        {!isLoadingPlans && plans.length === 0 ? (
          <article className="choose-plan__card">
            <p className="choose-plan__plan-name">Planos indisponiveis</p>
            <p className="choose-plan__plan-description">O catalogo de assinatura nao esta configurado para esta conta.</p>
          </article>
        ) : null}

        {plans.map((plan) => (
          <article key={plan.code} className="choose-plan__card">
            <p className="choose-plan__plan-name">{plan.name}</p>
            <div className="choose-plan__price">
              <span className="choose-plan__price-value">{formatPlanPrice(plan)}</span>
              <span className="choose-plan__price-period">{formatPlanPeriod(plan)}</span>
            </div>
            {plan.description ? <p className="choose-plan__plan-description">{plan.description}</p> : null}
            {plan.features.length > 0 ? (
              <ul className="choose-plan__features">
                {plan.features.map((feature) => (
                  <li key={feature} className="choose-plan__feature">
                    {feature}
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              className={`choose-plan__action${loadingPlan === plan.code ? " choose-plan__action--loading" : ""}`}
              disabled={loadingPlan !== null || status?.plan === plan.code}
              onClick={() => handleChoosePlan(plan.code)}
              type="button"
            >
              {status?.plan === plan.code ? "Plano atual" : loadingPlan === plan.code ? "Aguarde..." : `Assinar ${plan.name}`}
            </button>
          </article>
        ))}
      </div>

      <div className="choose-plan__footer">
        {error && <p className="choose-plan__error">{error}</p>}

        <p className="choose-plan__notice choose-plan__notice--summary">
          Acesso completo a plataforma apos a confirmacao do pagamento. Cobranca mensal recorrente, cancele quando
          quiser.
        </p>

        <p className="choose-plan__notice">
          Pagamento processado com seguranca via Stripe. Nenhum dado de cartao e armazenado pelo Dask.
        </p>
      </div>
    </main>
  );
}
