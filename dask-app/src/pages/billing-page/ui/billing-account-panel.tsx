import type { ConnectAccountStatus } from "@/modules/billing";
import { Button, StatusBadge } from "@/shared/ui";
import { IconAlertCircle, IconCheck, KPI_ICONS } from "./billing-page-icons";
import {
  formatCapabilityStatus,
  isLocalPaymentMethodEnabled,
  type BillingChecklistItem,
  type BillingOnboardingStage,
  type BillingOnboardingSummary,
  type BillingStatusCard,
  type PaymentCapability
} from "./billing-page.model";

interface BillingAccountPanelProps {
  statusCards: BillingStatusCard[];
  canCreateCheckout: boolean;
  onboardingSummary: BillingOnboardingSummary;
  currentOnboardingStage: BillingOnboardingStage;
  connectStatus: ConnectAccountStatus | null;
  pendingItems: BillingChecklistItem[];
  completedItems: BillingChecklistItem[];
  connectError: string | null;
  isOpeningOnboarding: boolean;
  requestingCapability: PaymentCapability | null;
  onOpenOnboarding: () => void | Promise<void>;
  onRequestPaymentCapability: (capability: PaymentCapability) => void | Promise<void>;
}

export function BillingAccountPanel({
  statusCards,
  canCreateCheckout,
  onboardingSummary,
  currentOnboardingStage,
  connectStatus,
  pendingItems,
  completedItems,
  connectError,
  isOpeningOnboarding,
  requestingCapability,
  onOpenOnboarding,
  onRequestPaymentCapability
}: BillingAccountPanelProps) {
  return (
    <div className="billing-view__panel billing-view__panel--account" role="tabpanel">
      <div className="billing-view__kpi-row">
        {statusCards.map((card) => {
          const Icon = KPI_ICONS[card.key];
          return (
            <div key={card.key} className={`billing-view__kpi-card billing-view__kpi-card--${card.tone}`}>
              <div className="billing-view__kpi-icon">
                <Icon />
              </div>
              <p className="billing-view__kpi-label">{card.label}</p>
              <p className="billing-view__kpi-value">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="billing-view__onboarding-card">
        <div className="billing-view__onboarding-header">
          <div className="billing-view__onboarding-copy">
            <div className={`billing-view__onboarding-status-dot billing-view__onboarding-status-dot--${canCreateCheckout ? "active" : "pending"}`} />
            <div>
              <h2 className="billing-view__onboarding-title">{onboardingSummary.title}</h2>
              {onboardingSummary.subtitle === "Conecte e complete o cadastro para liberar cobranças e repasses." ? null : (
                <p className="billing-view__onboarding-subtitle">{onboardingSummary.subtitle}</p>
              )}
            </div>
          </div>

          <div className="billing-view__onboarding-actions">
            <StatusBadge tone={canCreateCheckout ? "success" : "warning"}>
              {canCreateCheckout ? "Checkout liberado" : "Cadastro pendente"}
            </StatusBadge>
            {!canCreateCheckout ? (
              <Button
                type="button"
                variant="primary"
                className="billing-view__onboarding-cta"
                onClick={() => void onOpenOnboarding()}
                disabled={isOpeningOnboarding}
              >
                {isOpeningOnboarding ? "Abrindo..." : "Completar cadastro"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="billing-view__progress-wrap">
          <div className="billing-view__progress-meta">
            <span className="billing-view__progress-label">{onboardingSummary.progress}%</span>
          </div>
          <div className="billing-view__progress">
            <span style={{ width: `${onboardingSummary.progress}%` }} />
          </div>
        </div>

        <div className="billing-view__steps">
          <div
            className={`billing-view__step ${
              connectStatus?.detailsSubmitted
                ? "is-done"
                : currentOnboardingStage === "Cadastro"
                  ? "is-current"
                  : "is-pending"
            }`}
          >
            <span className="billing-view__step-check"><IconCheck /></span>
            <span>Cadastro</span>
          </div>
          <div
            className={`billing-view__step ${
              connectStatus?.chargesEnabled
                ? "is-done"
                : currentOnboardingStage === "Cobrança"
                  ? "is-current"
                  : "is-blocked"
            }`}
          >
            <span className="billing-view__step-check"><IconCheck /></span>
            <span>Cobrança</span>
          </div>
          <div
            className={`billing-view__step ${
              connectStatus?.payoutsEnabled
                ? "is-done"
                : currentOnboardingStage === "Repasse"
                  ? "is-current"
                  : "is-blocked"
            }`}
          >
            <span className="billing-view__step-check"><IconCheck /></span>
            <span>Repasse</span>
          </div>
        </div>
      </div>

      <div className="billing-view__card billing-view__card--capabilities">
        <div className="billing-view__card-head">
          <h3>Formas de pagamento locais</h3>
          <StatusBadge>Brasil</StatusBadge>
        </div>
        <div className="billing-view__capability-grid">
          <div className="billing-view__capability-row">
            <div className="billing-view__capability-copy billing-view__capability-copy--name">
              <strong>Boleto</strong>
            </div>
            <div className="billing-view__capability-copy billing-view__capability-copy--status">
              <span className="billing-view__capability-status-chip">
                {formatCapabilityStatus(connectStatus?.boletoPaymentsStatus)}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="billing-view__capability-action"
              onClick={() => void onRequestPaymentCapability("boleto_payments")}
              disabled={
                !connectStatus ||
                isLocalPaymentMethodEnabled(connectStatus.boletoPaymentsStatus) ||
                requestingCapability !== null
              }
            >
              {requestingCapability === "boleto_payments" ? "Solicitando..." : "Habilitar boleto"}
            </Button>
          </div>
        </div>
        {connectError ? <p className="billing-view__error">{connectError}</p> : null}
      </div>

      {pendingItems.length > 0 ? (
        <div className="billing-view__card billing-view__card--pending">
          <div className="billing-view__card-head">
            <h3>Pendências de cadastro</h3>
            <StatusBadge tone="warning">{pendingItems.length} itens</StatusBadge>
          </div>
          <div className="billing-view__pending-sections">
            <div className="billing-view__pending-group">
              <div className="billing-view__pending-table-head" aria-hidden="true">
                <span>Item</span>
                <span>Detalhe</span>
                <span>Status</span>
              </div>
              <ul className="billing-view__pending-list billing-view__pending-list--compact">
                {pendingItems.map((item) => (
                  <li key={item.key}>
                    <span className="billing-view__pending-item-icon" aria-hidden="true">
                      <IconAlertCircle />
                    </span>
                    <strong className="billing-view__pending-item-title">{item.title}</strong>
                    <p className="billing-view__pending-item-description">{item.description}</p>
                    <span className="billing-view__pending-item-status">Pendente</span>
                  </li>
                ))}
              </ul>
            </div>

            {completedItems.length > 0 ? (
              <div className="billing-view__pending-group billing-view__pending-group--secondary">
                <p className="billing-view__pending-group-title">Concluídas</p>
                <div className="billing-view__pending-table-head" aria-hidden="true">
                  <span>Item</span>
                  <span>Detalhe</span>
                  <span>Status</span>
                </div>
                <ul className="billing-view__pending-list billing-view__pending-list--compact billing-view__pending-list--resolved">
                  {completedItems.map((item) => (
                    <li key={item.key}>
                      <span className="billing-view__pending-item-icon billing-view__pending-item-icon--resolved" aria-hidden="true">
                        <IconCheck />
                      </span>
                      <strong className="billing-view__pending-item-title">{item.title}</strong>
                      <p className="billing-view__pending-item-description">Etapa concluída no cadastro da conta.</p>
                      <span className="billing-view__pending-item-status billing-view__pending-item-status--resolved">
                        Concluído
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        canCreateCheckout ? (
          <div className="billing-view__all-good">
            <span className="billing-view__all-good-icon"><IconCheck /></span>
            Nenhuma pendência. Sua conta está pronta para cobrar.
          </div>
        ) : null
      )}
    </div>
  );
}
