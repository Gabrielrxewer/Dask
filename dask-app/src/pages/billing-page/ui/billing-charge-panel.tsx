import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { normalizeMoneyInput, type BillingCheckoutFormValues, type ConnectCatalogItem } from "@/modules/billing";
import { formatCustomerOptionDetail, getCustomerDisplayName, type Customer } from "@/modules/workspace";
import {
  AppForm,
  AppFormActions,
  AppDialog,
  AppFormError,
  AppFormField,
  AppFormGrid,
  AppIcon,
  AppMoneyField,
  AppSelect,
  AppTextField,
  Button,
  InlineAlert
} from "@/shared/ui";
import { IconLock } from "./billing-page-icons";
import { BillingOrderDetailsPanel } from "./billing-order-details-panel";
import {
  CATALOG_BILLING_LABEL,
  formatAmount,
  type ChargeSource,
  type CustomersLoadState,
  type ReviewStep
} from "./billing-page.model";

interface BillingChargePanelProps {
  canCreateCheckout: boolean;
  isOpeningOnboarding: boolean;
  reviewStep: ReviewStep;
  activeCatalogItems: ConnectCatalogItem[];
  chargeSource: ChargeSource;
  selectedCatalogItemId: string;
  selectedCatalogItem: ConnectCatalogItem | null;
  amount: string;
  amountInCents: number | null;
  description: string;
  customers: Customer[];
  customersLoadState: CustomersLoadState;
  selectedCustomerId: string;
  selectedCustomer: Customer | null;
  customerEmail: string;
  sendEmailToCustomer: boolean;
  canReviewCharge: boolean;
  chargeForm: UseFormReturn<BillingCheckoutFormValues>;
  checkoutUrl: string | null;
  onGoToAccount: () => void;
  onOpenOnboarding: () => void | Promise<void>;
  onChargeSourceChange: (value: ChargeSource) => void;
  onSelectedCatalogItemClear: () => void;
  onUseCatalogItem: (item: ConnectCatalogItem) => void;
  onCustomerSelect: (customerId: string) => void;
  onPrepareCheckout: (values: BillingCheckoutFormValues) => void | Promise<void>;
  onCopyCheckoutUrl: () => void | Promise<void>;
  onCancelReview: () => void;
}

function getFieldError(form: UseFormReturn<BillingCheckoutFormValues>, name: keyof BillingCheckoutFormValues) {
  const message = form.formState.errors[name]?.message;
  return typeof message === "string" ? message : undefined;
}

export function BillingChargePanel({
  canCreateCheckout,
  isOpeningOnboarding,
  reviewStep,
  activeCatalogItems,
  chargeSource,
  selectedCatalogItemId,
  selectedCatalogItem,
  amountInCents,
  description,
  customers,
  customersLoadState,
  selectedCustomerId,
  selectedCustomer,
  customerEmail,
  sendEmailToCustomer,
  canReviewCharge,
  chargeForm,
  checkoutUrl,
  onGoToAccount,
  onOpenOnboarding,
  onChargeSourceChange,
  onSelectedCatalogItemClear,
  onUseCatalogItem,
  onCustomerSelect,
  onPrepareCheckout,
  onCopyCheckoutUrl,
  onCancelReview
}: BillingChargePanelProps) {
  const [isChargeComposerOpen, setIsChargeComposerOpen] = useState(false);

  const customerItems = [
    {
      value: "__none",
      label: customersLoadState === "loading" ? "Carregando clientes..." : "Selecionar cliente"
    },
    ...customers.map((customer) => {
      const detail = formatCustomerOptionDetail(customer, ["email", "document", "phone"]);
      return {
        value: customer.id,
        label: `${getCustomerDisplayName(customer)}${detail ? ` - ${detail}` : ""}`
      };
    })
  ];
  const composerTitle = chargeSource === "catalog" && selectedCatalogItem
    ? `Cobrar ${selectedCatalogItem.name}`
    : "Cobrança avulsa";
  const composerDescription = chargeSource === "catalog" && selectedCatalogItem
    ? `${formatAmount(selectedCatalogItem.amount, selectedCatalogItem.currency)} - ${CATALOG_BILLING_LABEL[selectedCatalogItem.billingType]}`
    : "Informe o valor, a descrição e o cliente para gerar o link de pagamento.";

  function openCatalogCharge(item: ConnectCatalogItem) {
    onUseCatalogItem(item);
    setIsChargeComposerOpen(true);
  }

  function openManualCharge() {
    onChargeSourceChange("manual");
    onSelectedCatalogItemClear();
    setIsChargeComposerOpen(true);
  }

  function closeComposer(open: boolean) {
    setIsChargeComposerOpen(open);
    if (!open) {
      onCancelReview();
    }
  }

  const chargeComposer = (
    <>
      <AppForm form={chargeForm} onSubmit={onPrepareCheckout} disabled={reviewStep === "preparing"}>
        <fieldset
          disabled={reviewStep === "preparing"}
          className={`billing-view__fieldset billing-view__charge-form billing-view__charge-form--${chargeSource}`}
        >
          {chargeSource === "catalog" && selectedCatalogItem ? (
            <div className="billing-view__selected-charge-item">
              <span className="billing-view__selected-charge-eyebrow">Item selecionado</span>
              <strong>{selectedCatalogItem.name}</strong>
              <span>{formatAmount(selectedCatalogItem.amount, selectedCatalogItem.currency)} · {CATALOG_BILLING_LABEL[selectedCatalogItem.billingType]}</span>
            </div>
          ) : null}

          {chargeSource === "manual" || activeCatalogItems.length === 0 ? (
            <AppFormGrid className="billing-view__form-grid" columns={2}>
              <AppMoneyField
                name="amount"
                label="Valor (R$)"
                className="billing-view__field"
                placeholder="100.00"
                normalizeOnBlur={normalizeMoneyInput}
              />
              <AppTextField
                name="description"
                label="Descricao"
                className="billing-view__field"
                placeholder="Descricao da cobranca"
              />
            </AppFormGrid>
          ) : null}

          <AppFormGrid className="billing-view__form-grid" columns={2}>
            <AppFormField
              label="Cliente cadastrado (opcional)"
              className="billing-view__field billing-view__field--grow"
              error={getFieldError(chargeForm, "customerId") ?? getFieldError(chargeForm, "customerDocument")}
            >
              <AppSelect
                value={selectedCustomerId || "__none"}
                onValueChange={(value) => onCustomerSelect(value === "__none" ? "" : value)}
                items={customerItems}
                aria-label="Cliente cadastrado"
                disabled={customersLoadState === "loading"}
              />
            </AppFormField>
          </AppFormGrid>

          {customersLoadState === "error" ? (
            <InlineAlert tone="danger">Nao foi possivel carregar o cadastro de clientes.</InlineAlert>
          ) : null}
          {!selectedCustomer ? (
            <InlineAlert tone="warning">
              Selecione um cliente cadastrado com CPF/CNPJ antes de gerar checkout.
            </InlineAlert>
          ) : null}
          {selectedCustomer && !selectedCustomer.document ? (
            <InlineAlert tone="danger">
              Complete CPF/CNPJ no cadastro do cliente antes de usar esta cobranca para fiscal.
            </InlineAlert>
          ) : null}

          <div className="billing-view__email-row">
            <AppTextField
              name="customerEmail"
              label="E-mail do cliente"
              className="billing-view__field billing-view__field--grow"
              placeholder="cliente@empresa.com"
            />
            <label className={`billing-view__send-email-toggle ${!customerEmail.trim() ? "is-disabled" : ""}`}>
              <input
                type="checkbox"
                checked={sendEmailToCustomer && customerEmail.trim().length > 0}
                disabled={!customerEmail.trim()}
                onChange={(event) =>
                  chargeForm.setValue("sendEmail", event.target.checked, {
                    shouldDirty: true,
                    shouldValidate: true
                  })
                }
              />
              Enviar link por e-mail
            </label>
          </div>

          <AppFormActions className="billing-view__actions">
            <Button
              type="submit"
              disabled={!canReviewCharge || reviewStep === "preparing"}
            >
              {reviewStep === "preparing" ? "Gerando link..." : "Gerar cobranca"}
            </Button>
          </AppFormActions>
        </fieldset>
      </AppForm>

      <BillingOrderDetailsPanel
        reviewStep={reviewStep}
        chargeSource={chargeSource}
        selectedCatalogItem={selectedCatalogItem}
        amountInCents={amountInCents}
        description={description}
        selectedCustomer={selectedCustomer}
        customerEmail={customerEmail}
        checkoutUrl={checkoutUrl}
        onCopyCheckoutUrl={onCopyCheckoutUrl}
        onCancelReview={onCancelReview}
      />
    </>
  );

  return (
    <div className="billing-view__panel" role="tabpanel">
      {!canCreateCheckout ? (
        <div className="billing-view__charge-blocked">
          <div className="billing-view__charge-blocked-icon">
            <IconLock />
          </div>
          <p className="billing-view__charge-blocked-title">Cadastro incompleto</p>
          <p className="billing-view__charge-blocked-desc">
            Complete o cadastro Stripe Connect para liberar cobrancas nesta conta.
          </p>
          <Button
            type="button"
            onClick={() => {
              onGoToAccount();
              void onOpenOnboarding();
            }}
            disabled={isOpeningOnboarding}
          >
            {isOpeningOnboarding ? "Abrindo..." : "Completar cadastro"}
          </Button>
        </div>
      ) : (
        <>
          <div className="billing-view__charge-catalog">
            <div className="billing-view__charge-catalog-head">
              <div>
                <span className="billing-view__charge-catalog-eyebrow">Itens do catálogo</span>
                <strong>Escolha um produto ou serviço para cobrar</strong>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={openManualCharge} className="billing-view__manual-charge-button">
                <AppIcon name="plus" size={14} />
                Cobrança avulsa
              </Button>
            </div>

            {activeCatalogItems.length > 0 ? (
              <div className="billing-view__charge-product-list">
                {activeCatalogItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`billing-view__charge-product ${selectedCatalogItemId === item.id ? "is-selected" : ""}`}
                    onClick={() => openCatalogCharge(item)}
                  >
                    <span className="billing-view__charge-product-main">
                      <strong>{item.name}</strong>
                      <span>{item.description || "Sem descricao"}</span>
                    </span>
                    <span className="billing-view__charge-product-meta">
                      <strong>{formatAmount(item.amount, item.currency)}</strong>
                      <span>{CATALOG_BILLING_LABEL[item.billingType]}</span>
                    </span>
                    <span className="billing-view__charge-product-action">
                      Cobrar
                      <AppIcon name="chevron-right" size={14} />
                    </span>
                  </button>
                ))}
                <AppFormError>{getFieldError(chargeForm, "catalogItemId")}</AppFormError>
              </div>
            ) : (
              <div className="billing-view__charge-empty">
                <AppIcon name="receipt" size={18} />
                <strong>Nenhum item ativo no catálogo</strong>
                <span>Use uma cobrança avulsa para gerar um link sem produto cadastrado.</span>
                <Button type="button" size="sm" variant="secondary" onClick={openManualCharge}>
                  Cobrança avulsa
                </Button>
              </div>
            )}
          </div>

          <AppDialog
            open={isChargeComposerOpen}
            onOpenChange={closeComposer}
            title={composerTitle}
            description={composerDescription}
            className="billing-charge-modal"
            contentClassName="billing-charge-modal__frame"
            bodyClassName="billing-charge-modal__body"
          >
            {chargeComposer}
          </AppDialog>
        </>
      )}
    </div>
  );
}
