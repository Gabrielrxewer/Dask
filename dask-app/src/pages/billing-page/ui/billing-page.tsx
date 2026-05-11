import { LoadingState, Section, WorkspaceFrame } from "@/shared/ui";
import { BoardMetrics } from "@/widgets/board-metrics";
import { AppShell } from "@/widgets/app-shell";
import { BillingAccountPanel } from "./billing-account-panel";
import { BillingCatalogDeleteModal } from "./billing-catalog-delete-modal";
import { BillingCatalogSection } from "./billing-catalog-section";
import { BillingChargePanel } from "./billing-charge-panel";
import { BillingHistoryPanel } from "./billing-history-panel";
import { BillingStatusTabs, BillingTopNavigation } from "./billing-status-tabs";
import { useBillingPageModel } from "./use-billing-page-model";
import "./billing-page.css";

export function BillingPage() {
  const billing = useBillingPageModel();

  return (
    <AppShell metrics={billing.metrics} hideSidebarBrandMark pageTitle="Assinatura do Dask e cobrancas" pageLabel="Financeiro">
      <WorkspaceFrame className="billing-view workspace-view" variant="dashboard" scroll="content">
        <LoadingState
          text="Carregando cobranca..."
          animation="billing"
          variant="frame"
          visible={billing.isBillingFrameLoading || billing.isOpeningOnboarding}
        />
        <BillingTopNavigation
          activeTab={billing.activeTab}
          pendingCount={billing.pendingItems.length}
          catalogCount={billing.catalogSectionProps.catalogItems.length}
          paymentOrderCount={billing.paymentOrders.length}
          canCreateCheckout={billing.canCreateCheckout}
          customerMode={billing.isClient}
          onTabChange={billing.setActiveTab}
        />
        <BoardMetrics
          metrics={billing.metrics}
          cards={billing.metricCards}
          className="billing-view__metrics workspace-view__metrics"
        />

        <Section
          title="Cobrancas dos seus clientes"
          subtitle="A assinatura do Dask fica separada da conta de recebimento Stripe Connect deste workspace."
          className="billing-view__section workspace-view__section"
        >
          <div className="billing-view__stack">
            <BillingStatusTabs
              activeTab={billing.activeTab}
              pendingCount={billing.pendingItems.length}
              catalogCount={billing.catalogSectionProps.catalogItems.length}
              paymentOrderCount={billing.paymentOrders.length}
              canCreateCheckout={billing.canCreateCheckout}
              customerMode={billing.isClient}
              onTabChange={billing.setActiveTab}
            />

            {!billing.isClient && billing.activeTab === "conta" ? <BillingAccountPanel {...billing.accountPanelProps} /> : null}

            {!billing.isClient && billing.activeTab === "catalogo" ? <BillingCatalogSection {...billing.catalogSectionProps} /> : null}

            {billing.catalogItemPendingDelete ? (
              <BillingCatalogDeleteModal
                item={billing.catalogItemPendingDelete}
                deletingCatalogItemId={billing.deletingCatalogItemId}
                onClose={() => billing.setCatalogItemPendingDelete(null)}
                onConfirm={billing.onConfirmDeleteCatalogItem}
              />
            ) : null}

            {!billing.isClient && billing.activeTab === "cobrar" ? <BillingChargePanel {...billing.chargePanelProps} /> : null}

            {billing.activeTab === "historico" || billing.isClient ? <BillingHistoryPanel {...billing.historyPanelProps} /> : null}
          </div>
        </Section>
      </WorkspaceFrame>
    </AppShell>
  );
}
