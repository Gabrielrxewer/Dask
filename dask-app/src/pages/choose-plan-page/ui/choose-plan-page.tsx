import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { routePaths } from "@/app/router/route-paths";
import { billingService, PLAN_DISPLAY } from "@/modules/billing";
import type { BillingStatus, SubscriptionPlan } from "@/modules/billing";
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

  const currentPlan = status?.plan ? PLAN_DISPLAY[status.plan] : null;
  const periodEndLabel = status?.currentPeriodEnd ? new Date(status.currentPeriodEnd).toLocaleDateString("pt-BR") : "Nao disponivel";

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

      {status ? (
        <section className="choose-plan__current-subscription" aria-label="Resumo da assinatura atual">
          <div className="choose-plan__current-subscription-copy">
            <p className="choose-plan__current-subscription-eyebrow">Assinatura atual</p>
            <h2>{currentPlan ? `${currentPlan.name} (${currentPlan.price}/mes)` : "Sem plano ativo"}</h2>
            <p>
              Status: <strong>{statusLabel}</strong> · Proxima renovacao: <strong>{periodEndLabel}</strong>
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
            {PLAN_FEATURES.BUSINESS.map((f) => (
              <li key={f} className="choose-plan__feature">{f}</li>
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

      {error && <p className="choose-plan__error">{error}</p>}

      <p className="choose-plan__notice">
        O acesso e liberado automaticamente apos a confirmacao do pagamento pelo Stripe. Nenhum dado de cartao e
        armazenado pelo Dask. Ao assinar, voce concorda com os <Link to={routePaths.termsOfUse}>Termos de Uso</Link> e
        com a <Link to={routePaths.privacyPolicy}> Politica de Privacidade</Link>.
      </p>
    </main>
  );
}
