import type { ConnectCatalogItem } from "@/modules/billing";
import { getCustomerDisplayName, type Customer } from "@/modules/workspace";
import { Button, LoadingState, StatusBadge } from "@/shared/ui";
import {
  CATALOG_BILLING_LABEL,
  formatAmount,
  type ChargeSource,
  type ReviewStep
} from "./billing-page.model";

interface BillingOrderDetailsPanelProps {
  reviewStep: ReviewStep;
  chargeSource: ChargeSource;
  selectedCatalogItem: ConnectCatalogItem | null;
  amountInCents: number | null;
  description: string;
  selectedCustomer: Customer | null;
  customerEmail: string;
  checkoutUrl: string | null;
  onCopyCheckoutUrl: () => void | Promise<void>;
  onCancelReview: () => void;
}

export function BillingOrderDetailsPanel({
  reviewStep,
  chargeSource,
  selectedCatalogItem,
  amountInCents,
  description,
  selectedCustomer,
  customerEmail,
  checkoutUrl,
  onCopyCheckoutUrl,
  onCancelReview
}: BillingOrderDetailsPanelProps) {
  if (reviewStep === "closed") return null;

  return (
    <div className="billing-view__card billing-view__card--review">
      <div className="billing-view__card-head">
        <h3>Link de cobrança</h3>
        <StatusBadge tone="success">Pronto para enviar</StatusBadge>
      </div>

      {reviewStep === "preparing" ? (
        <LoadingState
          className="billing-view__review-loading"
          text="Gerando link seguro via Stripe"
          animation="billing"
        />
      ) : (
        <>
          <div className="billing-view__review-grid">
            <span>
              <strong>Valor</strong>
              {chargeSource === "catalog" && selectedCatalogItem
                ? formatAmount(selectedCatalogItem.amount, selectedCatalogItem.currency)
                : `R$ ${((amountInCents ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            </span>
            <span>
              <strong>Descrição</strong>
              {chargeSource === "catalog" && selectedCatalogItem
                ? selectedCatalogItem.description || selectedCatalogItem.name
                : description}
            </span>
            <span>
              <strong>Cliente</strong>
              {getCustomerDisplayName(selectedCustomer) || customerEmail.trim() || "Não informado"}
            </span>
            <span>
              <strong>Origem</strong>
              {chargeSource === "catalog"
                ? `Catálogo (${selectedCatalogItem ? CATALOG_BILLING_LABEL[selectedCatalogItem.billingType] : "item"})`
                : "Cobrança avulsa"}
            </span>
          </div>

          <div className="billing-view__checkout-link">
            <div className="billing-view__checkout-link-head">
              <span className="billing-view__checkout-link-label">Link de pagamento</span>
            </div>
            <div
              className="billing-view__checkout-link-row"
              onClick={() => void onCopyCheckoutUrl()}
              title={checkoutUrl ?? undefined}
            >
              <span className="billing-view__checkout-link-url">{checkoutUrl}</span>
              <button
                type="button"
                className="billing-view__copy-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  void onCopyCheckoutUrl();
                }}
              >
                Copiar link
              </button>
            </div>
            <span className="billing-view__checkout-link-hint">
              Clique no bloco para copiar. Avulsa aceita cartão e boleto; assinatura aceita só cartão.
            </span>
          </div>

          <div className="billing-view__actions shared-actions-row">
            <Button type="button" variant="outline" onClick={onCancelReview}>
              Fechar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (checkoutUrl) window.location.href = checkoutUrl;
              }}
            >
              Abrir checkout
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
