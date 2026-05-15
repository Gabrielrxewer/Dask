import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { routePaths } from "@/app/router";
import {
  useBillingPlansQuery,
  useBillingStatusQuery,
  useCreateBillingPortalSessionMutation,
  useCreateSubscriptionCheckoutMutation
} from "@/modules/billing";
import type { BillingPlan, BillingStatus, SubscriptionPlan } from "@/modules/billing";
import "./choose-plan-page.css";

const SUBSCRIPTION_TERMS_VERSION = "2026-05-14";
const PRIVACY_POLICY_VERSION = "2026-05-14";
const PLAN_ORDER: SubscriptionPlan[] = ["BASIC", "PRO", "BUSINESS", "ENTERPRISE", "PERSONAL"];

function formatPlanPrice(plan: BillingPlan): string {
  if (plan.code === "ENTERPRISE") {
    return "Solicitar orcamento";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: plan.currency.toUpperCase()
  }).format(plan.amount / 100);
}

function formatPlanPeriod(plan: BillingPlan): string {
  if (plan.code === "ENTERPRISE") return "";
  if (plan.interval === "month") return "/mes";
  if (plan.interval === "year") return "/ano";
  if (plan.interval) return `/${plan.interval}`;
  return "";
}

export function ChoosePlanPage() {
  const [loadingPlan, setLoadingPlan] = useState<SubscriptionPlan | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const statusQuery = useBillingStatusQuery();
  const plansQuery = useBillingPlansQuery();
  const checkoutMutation = useCreateSubscriptionCheckoutMutation();
  const portalMutation = useCreateBillingPortalSessionMutation();

  useEffect(() => {
    if (statusQuery.isError || plansQuery.isError) {
      setError("Nao foi possivel carregar os planos configurados.");
    }
  }, [plansQuery.isError, statusQuery.isError]);

  const status: BillingStatus | null = statusQuery.data ?? null;
  const plans: BillingPlan[] = useMemo(
    () => (plansQuery.data?.items.filter((plan) => plan.isActive && plan.code !== "PERSONAL") ?? [])
      .sort((left, right) => PLAN_ORDER.indexOf(left.code) - PLAN_ORDER.indexOf(right.code)),
    [plansQuery.data]
  );
  const isLoadingPlans = statusQuery.isLoading || plansQuery.isLoading;

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
    if (plan === "ENTERPRISE") {
      window.location.href = "mailto:comercial@dask.com.br?subject=Orcamento%20Enterprise%20Dask";
      return;
    }
    if (!acceptedLegalTerms) {
      setError("Aceite os termos de assinatura e a politica de privacidade antes de assinar.");
      return;
    }

    setLoadingPlan(plan);
    setError(null);

    try {
      const { url } = await checkoutMutation.mutateAsync({
        planCode: plan,
        acceptedTerms: true,
        acceptedTermsVersion: SUBSCRIPTION_TERMS_VERSION,
        acceptedPrivacyVersion: PRIVACY_POLICY_VERSION
      });
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
      const { url } = await portalMutation.mutateAsync();
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
          <p className="choose-plan__eyebrow">Assinatura Dask</p>
          <h1 className="choose-plan__title">Monte seu fluxo de receita no plano certo.</h1>
          <p className="choose-plan__description">
            Escolha como sua operacao vai conectar CRM, proposta, contrato, cobranca, fiscal, automacoes e IA no mesmo trilho comercial.
          </p>
          <p className="choose-plan__description choose-plan__description--legal">
            Todos os planos ativos usam workspace business. O workspace personal fica obsoleto por enquanto e novas
            assinaturas sao contratadas para operacao empresarial.
          </p>
        </header>

        <aside className="choose-plan__flow-panel" aria-label="Fluxo operacional incluso no Dask">
          {["Lead", "Proposta", "Contrato", "Cobranca", "Pagamento", "Fiscal"].map((step) => (
            <span key={step}>{step}</span>
          ))}
        </aside>
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

        {plans.map((plan) => {
          const isFeaturedPlan = plan.code === "BUSINESS";
          const cardClassName = ["choose-plan__card", isFeaturedPlan && "choose-plan__card--featured"]
            .filter(Boolean)
            .join(" ");

          return (
            <article key={plan.code} className={cardClassName}>
              {isFeaturedPlan ? <span className="choose-plan__badge">Operacao completa</span> : null}
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
                {status?.plan === plan.code
                  ? "Plano atual"
                  : plan.code === "ENTERPRISE"
                    ? "Solicitar orcamento"
                    : loadingPlan === plan.code
                      ? "Aguarde..."
                      : `Assinar ${plan.name}`}
              </button>
            </article>
          );
        })}
      </div>

      <div className="choose-plan__footer">
        <label className="choose-plan__legal-acceptance">
          <input
            type="checkbox"
            checked={acceptedLegalTerms}
            onChange={(event) => {
              setAcceptedLegalTerms(event.target.checked);
              if (event.target.checked) {
                setError(null);
              }
            }}
          />
          <span>
            Li e aceito os <Link to={routePaths.termsOfUse}>Termos de Uso e Assinatura</Link>, a{" "}
            <Link to={routePaths.privacyPolicy}>Politica de Privacidade</Link>, a cobranca recorrente mensal e as
            regras de cancelamento do Dask.
          </span>
        </label>

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
