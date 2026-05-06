import type { ConnectCatalogItem } from "@/modules/billing";
import { Button, EmptyState, SectionHeader } from "@/shared/ui";
import { BillingCatalogForm, type BillingCatalogFormProps } from "./billing-catalog-form";
import {
  CATALOG_BILLING_LABEL,
  CATALOG_KIND_LABEL,
  formatAmount,
  type CatalogLoadState
} from "./billing-page.model";

interface BillingCatalogSectionProps {
  catalogItems: ConnectCatalogItem[];
  catalogLoadState: CatalogLoadState;
  catalogCreatedNotice: boolean;
  isCatalogFormOpen: boolean;
  deletingCatalogItemId: string | null;
  formProps: BillingCatalogFormProps;
  onToggleCatalogForm: () => void;
  onChargeNow: () => void;
  onUseCatalogItem: (item: ConnectCatalogItem) => void;
  onRequestDeleteCatalogItem: (item: ConnectCatalogItem) => void;
}

export function BillingCatalogSection({
  catalogItems,
  catalogLoadState,
  catalogCreatedNotice,
  isCatalogFormOpen,
  deletingCatalogItemId,
  formProps,
  onToggleCatalogForm,
  onChargeNow,
  onUseCatalogItem,
  onRequestDeleteCatalogItem
}: BillingCatalogSectionProps) {
  return (
    <div className="billing-view__panel billing-view__panel--catalog" role="tabpanel">
      <SectionHeader
        title="Catálogo"
        description="Produtos e serviços prontos para cobrar, orçar e contratar."
        action={
          <Button type="button" variant="outline" onClick={onToggleCatalogForm}>
            {isCatalogFormOpen ? "Cancelar" : "+ Novo item"}
          </Button>
        }
      />

      {catalogCreatedNotice ? (
        <div className="billing-view__notice billing-view__notice--success">
          Item criado e selecionado.{" "}
          <button type="button" className="billing-view__notice-link" onClick={onChargeNow}>
            Cobrar agora →
          </button>
        </div>
      ) : null}

      {isCatalogFormOpen ? <BillingCatalogForm {...formProps} /> : null}

      {catalogLoadState === "loaded" && catalogItems.length === 0 ? (
        <EmptyState>
          Nenhum item cadastrado. Crie produtos ou serviços para cobrar em um clique.
        </EmptyState>
      ) : null}

      {catalogLoadState === "loaded" && catalogItems.length > 0 ? (
        <div className="billing-view__catalog-grid">
          {catalogItems.map((item) => (
            <div key={item.id} className="billing-view__catalog-card">
              <div className="billing-view__catalog-card-top">
                <div className="billing-view__catalog-card-badges">
                  <span className="billing-view__badge">{CATALOG_KIND_LABEL[item.kind]}</span>
                  <span className="billing-view__badge">{CATALOG_BILLING_LABEL[item.billingType]}</span>
                </div>
                <p className="billing-view__catalog-card-price">
                  {formatAmount(item.amount, item.currency)}
                </p>
              </div>
              <p className="billing-view__catalog-card-name">{item.name}</p>
              {item.description ? <p className="billing-view__catalog-card-desc">{item.description}</p> : null}
              {item.metadata ? (
                <div className="billing-view__catalog-card-meta">
                  {item.metadata.defaultQuantity || item.metadata.unit ? (
                    <span>
                      <strong>Base</strong>
                      {[item.metadata.defaultQuantity, item.metadata.unit].filter(Boolean).join(" ")}
                    </span>
                  ) : null}
                  {item.metadata.deliveryTerms ? (
                    <span>
                      <strong>Prazo</strong>
                      {item.metadata.deliveryTerms}
                    </span>
                  ) : null}
                  {item.metadata.contractTerm ? (
                    <span>
                      <strong>Vigência</strong>
                      {item.metadata.contractTerm}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="billing-view__catalog-card-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onUseCatalogItem(item);
                    onChargeNow();
                  }}
                  disabled={!item.isActive}
                >
                  Cobrar este item →
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onRequestDeleteCatalogItem(item)}
                  disabled={!item.isActive || deletingCatalogItemId !== null}
                >
                  {deletingCatalogItemId === item.id ? "Excluindo..." : "Excluir"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
