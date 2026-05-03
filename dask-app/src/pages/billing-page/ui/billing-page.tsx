import { Section, WorkspaceFrame } from "@/shared/ui";
import { BoardMetrics } from "@/widgets/board-metrics";
import { AppShell } from "@/widgets/app-shell";
import { BillingAccountPanel } from "./billing-account-panel";
import { BillingCatalogDeleteModal } from "./billing-catalog-delete-modal";
import { BillingCatalogSection } from "./billing-catalog-section";
import { BillingChargePanel } from "./billing-charge-panel";
import { BillingHistoryPanel } from "./billing-history-panel";
import { BillingLoader } from "./billing-loader";
import { BillingStatusTabs, BillingTopNavigation } from "./billing-status-tabs";
import { useBillingPageModel } from "./use-billing-page-model";
import "./billing-page.css";

export function BillingPage() {
  const billing = useBillingPageModel();

  return (
    <AppShell metrics={billing.metrics} hideSidebarBrandMark pageTitle="Cobrança" pageLabel="Financeiro">
      <BillingLoader visible={billing.isBillingFrameLoading || billing.isOpeningOnboarding} />
      <WorkspaceFrame className="billing-view workspace-view">
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

        {billing.checkoutResult === "success" ? (
          <div className="billing-view__result billing-view__result--success">
            Pagamento concluído. A Stripe confirmou o checkout com sucesso.
          </div>
        ) : null}
        {billing.checkoutResult === "cancel" ? (
          <div className="billing-view__result billing-view__result--warning">
            Checkout cancelado. Revise os dados e tente novamente quando quiser.
          </div>
        ) : null}

        <Section
          title="Cobrança Connect"
          subtitle="Gerencie cadastro, cobrança e repasses com o mesmo estilo visual do workspace."
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
