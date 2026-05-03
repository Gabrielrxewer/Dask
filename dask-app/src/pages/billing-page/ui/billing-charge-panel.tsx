import type { ConnectCatalogItem } from "@/modules/billing";
import { formatCustomerOptionDetail, getCustomerDisplayName, type Customer } from "@/modules/workspace";
import { Button, FormField, Select, TextInput } from "@/shared/ui";
import { IconCheck, IconLock } from "./billing-page-icons";
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
  checkoutError: string | null;
  checkoutUrl: string | null;
  linkCopied: boolean;
  emailSentNotice: boolean;
  onGoToAccount: () => void;
  onOpenOnboarding: () => void | Promise<void>;
  onChargeSourceChange: (value: ChargeSource) => void;
  onSelectedCatalogItemClear: () => void;
  onUseCatalogItem: (item: ConnectCatalogItem) => void;
  onAmountChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCustomerSelect: (customerId: string) => void;
  onCustomerEmailChange: (value: string) => void;
  onSendEmailToCustomerChange: (value: boolean) => void;
  onPrepareCheckout: () => void | Promise<void>;
  onCopyCheckoutUrl: () => void | Promise<void>;
  onCancelReview: () => void;
}

export function BillingChargePanel({
  canCreateCheckout,
  isOpeningOnboarding,
  reviewStep,
  activeCatalogItems,
  chargeSource,
  selectedCatalogItemId,
  selectedCatalogItem,
  amount,
  amountInCents,
  description,
  customers,
  customersLoadState,
  selectedCustomerId,
  selectedCustomer,
  customerEmail,
  sendEmailToCustomer,
  canReviewCharge,
  checkoutError,
  checkoutUrl,
  linkCopied,
  emailSentNotice,
  onGoToAccount,
  onOpenOnboarding,
  onChargeSourceChange,
  onSelectedCatalogItemClear,
  onUseCatalogItem,
  onAmountChange,
  onDescriptionChange,
  onCustomerSelect,
  onCustomerEmailChange,
  onSendEmailToCustomerChange,
  onPrepareCheckout,
  onCopyCheckoutUrl,
  onCancelReview
}: BillingChargePanelProps) {
  return (
    <div className="billing-view__panel" role="tabpanel">
      {!canCreateCheckout ? (
        <div className="billing-view__charge-blocked">
          <div className="billing-view__charge-blocked-icon">
            <IconLock />
          </div>
          <p className="billing-view__charge-blocked-title">Cadastro incompleto</p>
          <p className="billing-view__charge-blocked-desc">
            Complete o cadastro Stripe Connect para liberar cobranças nesta conta.
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
          <fieldset
            disabled={reviewStep === "preparing"}
            className="billing-view__fieldset billing-view__charge-form"
          >
            {activeCatalogItems.length > 0 ? (
              <>
                <div className="billing-view__source-toggle">
                  <button
                    type="button"
                    className={`billing-view__source-btn ${chargeSource === "catalog" ? "is-active" : ""}`}
                    onClick={() => onChargeSourceChange("catalog")}
                  >
                    Do catálogo
                  </button>
                  <button
                    type="button"
                    className={`billing-view__source-btn ${chargeSource === "manual" ? "is-active" : ""}`}
                    onClick={() => {
                      onChargeSourceChange("manual");
                      onSelectedCatalogItemClear();
                    }}
                  >
                    Avulsa
                  </button>
                </div>

                {chargeSource === "catalog" ? (
                  <div className="billing-view__charge-items">
                    {activeCatalogItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`billing-view__charge-item ${selectedCatalogItemId === item.id ? "is-selected" : ""}`}
                        onClick={() => onUseCatalogItem(item)}
                      >
                        <span className="billing-view__charge-item-name">{item.name}</span>
                        <span className="billing-view__charge-item-price">
                          {formatAmount(item.amount, item.currency)}
                        </span>
                        <span className="billing-view__charge-item-type">
                          {CATALOG_BILLING_LABEL[item.billingType]}
                        </span>
                        {selectedCatalogItemId === item.id ? (
                          <span className="billing-view__charge-item-check"><IconCheck /></span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}

            {chargeSource === "manual" || activeCatalogItems.length === 0 ? (
              <div className="billing-view__form-grid shared-form-grid shared-form-grid--two">
                <FormField label="Valor (R$)" className="billing-view__field">
                  <TextInput
                    value={amount}
                    onChange={(e) => onAmountChange(e.target.value)}
                    placeholder="100.00"
                  />
                </FormField>
                <FormField label="Descrição" className="billing-view__field">
                  <TextInput
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    placeholder="Descrição da cobrança"
                  />
                </FormField>
              </div>
            ) : null}

            <div className="billing-view__form-grid shared-form-grid shared-form-grid--two">
              <FormField label="Cliente cadastrado (opcional)" className="billing-view__field billing-view__field--grow">
                <Select
                  value={selectedCustomerId}
                  onChange={(e) => onCustomerSelect(e.target.value)}
                  disabled={customersLoadState === "loading"}
                >
                  <option value="">
                    {customersLoadState === "loading" ? "Carregando clientes..." : "Selecionar cliente"}
                  </option>
                  {customers.map((customer) => {
                    const detail = formatCustomerOptionDetail(customer, ["email", "document", "phone"]);
                    return (
                      <option key={customer.id} value={customer.id}>
                        {getCustomerDisplayName(customer)}{detail ? ` - ${detail}` : ""}
                      </option>
                    );
                  })}
                </Select>
              </FormField>
            </div>
            {customersLoadState === "error" ? (
              <p className="billing-view__error">Nao foi possivel carregar o cadastro de clientes.</p>
            ) : null}
            {selectedCustomer && !selectedCustomer.document ? (
              <p className="billing-view__error">
                Complete CPF/CNPJ no cadastro do cliente antes de usar esta cobranca para fiscal.
              </p>
            ) : null}

            <div className="billing-view__email-row">
              <FormField label="E-mail do cliente" className="billing-view__field billing-view__field--grow">
                <TextInput
                  value={customerEmail}
                  onChange={(e) => onCustomerEmailChange(e.target.value)}
                  placeholder="cliente@empresa.com"
                />
              </FormField>
              <label className={`billing-view__send-email-toggle ${!customerEmail.trim() ? "is-disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={sendEmailToCustomer && customerEmail.trim().length > 0}
                  disabled={!customerEmail.trim()}
                  onChange={(e) => onSendEmailToCustomerChange(e.target.checked)}
                />
                Enviar link por e-mail
              </label>
            </div>

            <div className="billing-view__actions shared-actions-row">
              <Button
                type="button"
                onClick={() => void onPrepareCheckout()}
                disabled={!canReviewCharge || reviewStep === "preparing"}
              >
                {reviewStep === "preparing" ? "Gerando link..." : "Gerar cobrança"}
              </Button>
            </div>
          </fieldset>

          {checkoutError ? <p className="billing-view__error">{checkoutError}</p> : null}

          <BillingOrderDetailsPanel
            reviewStep={reviewStep}
            chargeSource={chargeSource}
            selectedCatalogItem={selectedCatalogItem}
            amountInCents={amountInCents}
            description={description}
            selectedCustomer={selectedCustomer}
            customerEmail={customerEmail}
            checkoutUrl={checkoutUrl}
            linkCopied={linkCopied}
            emailSentNotice={emailSentNotice}
            onCopyCheckoutUrl={onCopyCheckoutUrl}
            onCancelReview={onCancelReview}
          />
        </>
      )}
    </div>
  );
}
