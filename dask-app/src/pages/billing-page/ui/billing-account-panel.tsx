import type { ConnectAccountStatus } from "@/modules/billing";
import { Button, DataTable, InlineAlert, StatusBadge, type DataTableColumn } from "@/shared/ui";
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
  canManageSensitiveConnectSettings: boolean;
  requestingCapability: PaymentCapability | null;
  onOpenOnboarding: () => void | Promise<void>;
  onRequestPaymentCapability: (capability: PaymentCapability) => void | Promise<void>;
}

interface BillingPendingRow extends BillingChecklistItem {
  statusLabel: string;
  resolved?: boolean;
}

const pendingColumns: Array<DataTableColumn<BillingPendingRow>> = [
  {
    id: "item",
    header: "Item",
    width: "1fr",
    render: (item) => (
      <span className="billing-view__pending-item-copy">
        <span
          className={`billing-view__pending-item-icon${item.resolved ? " billing-view__pending-item-icon--resolved" : ""}`}
          aria-hidden="true"
        >
          {item.resolved ? <IconCheck /> : <IconAlertCircle />}
        </span>
        <strong className="billing-view__pending-item-title">{item.title}</strong>
      </span>
    )
  },
  {
    id: "detail",
    header: "Detalhe",
    width: "1fr",
    render: (item) => <span className="billing-view__pending-item-description">{item.description}</span>
  },
  {
    id: "status",
    header: "Status",
    width: "0.7fr",
    render: (item) => (
      <span className={`billing-view__pending-item-status${item.resolved ? " billing-view__pending-item-status--resolved" : ""}`}>
        {item.statusLabel}
      </span>
    )
  }
];

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
  canManageSensitiveConnectSettings,
  requestingCapability,
  onOpenOnboarding,
  onRequestPaymentCapability
}: BillingAccountPanelProps) {
  const sensitivePermissionMessage = "Apenas o proprietario do workspace pode alterar a configuracao sensivel do Stripe Connect.";
  const blockingRequirementsCount =
    (connectStatus?.requirementsDue.length ?? 0) + (connectStatus?.requirementsPastDue.length ?? 0);
  const pendingRequirements = [
    ...(connectStatus?.requirementsPastDue ?? []),
    ...(connectStatus?.requirementsDue ?? [])
  ];
  const pendingRows: BillingPendingRow[] = pendingItems.map((item) => ({
    ...item,
    statusLabel: "Pendente"
  }));
  const completedRows: BillingPendingRow[] = completedItems.map((item) => ({
    ...item,
    description: "Etapa concluída no cadastro da conta.",
    statusLabel: "Concluído",
    resolved: true
  }));
  const isConnectReady = Boolean(
    connectStatus?.detailsSubmitted &&
    connectStatus?.chargesEnabled &&
    connectStatus?.payoutsEnabled &&
    blockingRequirementsCount === 0
  );
  const nextStep = !connectStatus
    ? "Iniciar verificacao da conta Stripe"
    : isConnectReady
      ? "Conta pronta para receber pagamentos"
      : connectStatus.disabledReason
        ? "Resolver bloqueio indicado pela Stripe"
        : !connectStatus.detailsSubmitted
          ? "Completar verificacao na Stripe"
          : blockingRequirementsCount > 0
            ? "Enviar pendencias solicitadas pela Stripe"
            : !connectStatus.payoutsEnabled
              ? "Validar conta para repasses"
              : "Aguardar revisao da Stripe";

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
              <p className="billing-view__onboarding-subtitle">
                Usaremos os dados legais do workspace para iniciar sua conta Stripe Connect. A Stripe pode solicitar informacoes adicionais de verificacao, representante legal, documentos, dados fiscais e conta bancaria.
              </p>
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
                disabled={isOpeningOnboarding || !canManageSensitiveConnectSettings}
                title={!canManageSensitiveConnectSettings ? sensitivePermissionMessage : undefined}
              >
                {isOpeningOnboarding ? "Abrindo..." : connectStatus ? "Completar verificacao na Stripe" : "Continuar cadastro de cobranca"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="billing-view__onboarding-cta"
                onClick={() => void onOpenOnboarding()}
                disabled={isOpeningOnboarding || !canManageSensitiveConnectSettings}
                title={!canManageSensitiveConnectSettings ? sensitivePermissionMessage : undefined}
              >
                {isOpeningOnboarding ? "Abrindo..." : "Atualizar dados na Stripe"}
              </Button>
            )}
          </div>
        </div>

        <div className="billing-view__connect-status-list">
          <span><strong>{connectStatus ? "Sim" : "Nao"}</strong> Conta Connect criada</span>
          <span><strong>{connectStatus?.chargesEnabled ? "Sim" : "Nao"}</strong> Cobrancas habilitadas</span>
          <span><strong>{connectStatus?.payoutsEnabled ? "Sim" : "Nao"}</strong> Repasses habilitados</span>
          <span><strong>{blockingRequirementsCount}</strong> Pendencias cadastrais</span>
          <span className="billing-view__connect-status-list-wide"><strong>Proximo passo:</strong> {nextStep}</span>
        </div>

        {pendingRequirements.length > 0 ? (
          <p className="billing-view__onboarding-subtitle">
            Pendencias principais: {pendingRequirements.slice(0, 4).join(", ")}
            {pendingRequirements.length > 4 ? ` e mais ${pendingRequirements.length - 4}` : ""}.
          </p>
        ) : null}

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
        {connectStatus?.disabledReason ? (
          <InlineAlert tone="warning">
            Stripe bloqueou temporariamente a conta: {connectStatus.disabledReason}. Continue o onboarding para liberar cobrancas.
          </InlineAlert>
        ) : null}
        {connectStatus?.dashboardType || connectStatus?.requirementCollection ? (
          <p className="billing-view__capability-copy">
            Dashboard: {connectStatus.dashboardType ?? "nao informado"} - KYC: {connectStatus.requirementCollection ?? "nao informado"}
          </p>
        ) : null}
        {!canManageSensitiveConnectSettings ? (
          <InlineAlert tone="warning">
            Apenas o proprietario do workspace pode alterar onboarding e formas de pagamento do Stripe Connect.
          </InlineAlert>
        ) : null}
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
                !canManageSensitiveConnectSettings ||
                isLocalPaymentMethodEnabled(connectStatus.boletoPaymentsStatus) ||
                requestingCapability !== null
              }
              title={!canManageSensitiveConnectSettings ? sensitivePermissionMessage : undefined}
            >
              {requestingCapability === "boleto_payments" ? "Solicitando..." : "Habilitar boleto"}
            </Button>
          </div>
        </div>
        {connectError ? <InlineAlert tone="danger">{connectError}</InlineAlert> : null}
      </div>

      {pendingItems.length > 0 ? (
        <div className="billing-view__card billing-view__card--pending">
          <div className="billing-view__card-head">
            <h3>Pendências de cadastro</h3>
            <StatusBadge tone="warning">{pendingItems.length} itens</StatusBadge>
          </div>
          <div className="billing-view__pending-sections">
            <div className="billing-view__pending-group">
              <DataTable<BillingPendingRow>
                className="billing-view__table billing-view__pending-table"
                data={pendingRows}
                columns={pendingColumns}
                getRowId={(item) => item.key}
                responsiveMinWidth="760px"
                emptyState={null}
              />
            </div>

            {completedItems.length > 0 ? (
              <div className="billing-view__pending-group billing-view__pending-group--secondary">
                <p className="billing-view__pending-group-title">Concluídas</p>
                <DataTable<BillingPendingRow>
                  className="billing-view__table billing-view__pending-table"
                  data={completedRows}
                  columns={pendingColumns}
                  getRowId={(item) => item.key}
                  responsiveMinWidth="760px"
                  emptyState={null}
                />
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
