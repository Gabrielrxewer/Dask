import type {
  ConnectCatalogBillingType,
  ConnectCatalogItemKind,
  ConnectCatalogRecurringInterval
} from "@/modules/billing";
import { AppIcon, Button, FormField, InlineAlert, ModalShell, Select, Textarea, TextInput } from "@/shared/ui";
import { isRecurringCatalogBillingType } from "./billing-page.model";

export interface BillingCatalogFormProps {
  mode: "create" | "edit";
  catalogItemKind: ConnectCatalogItemKind;
  catalogItemBillingType: ConnectCatalogBillingType;
  catalogItemRecurringInterval: ConnectCatalogRecurringInterval;
  catalogItemRecurringIntervalCount: number;
  catalogItemName: string;
  catalogItemDescription: string;
  catalogItemAmount: string;
  catalogItemUnit: string;
  catalogItemQuantity: string;
  catalogItemScope: string;
  catalogItemDeliverables: string;
  catalogItemDeliveryTerms: string;
  catalogItemPaymentTerms: string;
  catalogItemProposalValidity: string;
  catalogItemContractTerm: string;
  catalogItemCancellationTerms: string;
  catalogItemClientResponsibilities: string;
  catalogItemAcceptanceCriteria: string;
  catalogItemContractNotes: string;
  isCreatingCatalogItem: boolean;
  canCreateCatalogItem: boolean;
  catalogError: string | null;
  onCatalogItemKindChange: (value: ConnectCatalogItemKind) => void;
  onCatalogItemBillingTypeChange: (value: ConnectCatalogBillingType) => void;
  onCatalogItemRecurringChange: (interval: ConnectCatalogRecurringInterval, intervalCount: number) => void;
  onCatalogItemNameChange: (value: string) => void;
  onCatalogItemDescriptionChange: (value: string) => void;
  onCatalogItemAmountChange: (value: string) => void;
  onCatalogItemUnitChange: (value: string) => void;
  onCatalogItemQuantityChange: (value: string) => void;
  onCatalogItemScopeChange: (value: string) => void;
  onCatalogItemDeliverablesChange: (value: string) => void;
  onCatalogItemDeliveryTermsChange: (value: string) => void;
  onCatalogItemPaymentTermsChange: (value: string) => void;
  onCatalogItemProposalValidityChange: (value: string) => void;
  onCatalogItemContractTermChange: (value: string) => void;
  onCatalogItemCancellationTermsChange: (value: string) => void;
  onCatalogItemClientResponsibilitiesChange: (value: string) => void;
  onCatalogItemAcceptanceCriteriaChange: (value: string) => void;
  onCatalogItemContractNotesChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void | Promise<void>;
}

export function BillingCatalogForm({
  mode,
  catalogItemKind,
  catalogItemBillingType,
  catalogItemRecurringInterval,
  catalogItemRecurringIntervalCount,
  catalogItemName,
  catalogItemDescription,
  catalogItemAmount,
  catalogItemUnit,
  catalogItemQuantity,
  catalogItemScope,
  catalogItemDeliverables,
  catalogItemDeliveryTerms,
  catalogItemPaymentTerms,
  catalogItemProposalValidity,
  catalogItemContractTerm,
  catalogItemCancellationTerms,
  catalogItemClientResponsibilities,
  catalogItemAcceptanceCriteria,
  catalogItemContractNotes,
  isCreatingCatalogItem,
  canCreateCatalogItem,
  catalogError,
  onCatalogItemKindChange,
  onCatalogItemBillingTypeChange,
  onCatalogItemRecurringChange,
  onCatalogItemNameChange,
  onCatalogItemDescriptionChange,
  onCatalogItemAmountChange,
  onCatalogItemUnitChange,
  onCatalogItemQuantityChange,
  onCatalogItemScopeChange,
  onCatalogItemDeliverablesChange,
  onCatalogItemDeliveryTermsChange,
  onCatalogItemPaymentTermsChange,
  onCatalogItemProposalValidityChange,
  onCatalogItemContractTermChange,
  onCatalogItemCancellationTermsChange,
  onCatalogItemClientResponsibilitiesChange,
  onCatalogItemAcceptanceCriteriaChange,
  onCatalogItemContractNotesChange,
  onCancel,
  onSubmit
}: BillingCatalogFormProps) {
  const titleId = "billing-catalog-form-title";
  const isEditMode = mode === "edit";
  const isRecurring = isRecurringCatalogBillingType(catalogItemBillingType);

  return (
    <ModalShell titleId={titleId} className="billing-catalog-modal" onClose={isCreatingCatalogItem ? () => undefined : onCancel}>
      <form
        className="billing-catalog-modal__surface"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isCreatingCatalogItem && canCreateCatalogItem) {
            void onSubmit();
          }
        }}
      >
        <header className="billing-catalog-modal__header">
          <div className="billing-catalog-modal__heading">
            <p>{isEditMode ? "Editar cadastro" : "Novo cadastro"}</p>
            <h2 id={titleId}>{isEditMode ? "Editar item do catálogo" : "Novo item do catálogo"}</h2>
            <span>Defina as informações comerciais usadas em cobrança, orçamento, proposta e contrato.</span>
          </div>
          <button
            type="button"
            className="billing-catalog-modal__close"
            onClick={onCancel}
            disabled={isCreatingCatalogItem}
            aria-label="Fechar formulário"
          >
            <AppIcon name="x" size={15} />
          </button>
        </header>

        <div className="billing-catalog-modal__body">
          <section className="billing-catalog-modal__section">
            <div className="billing-catalog-modal__section-head">
              <span>01</span>
              <div>
                <h3>Identificação</h3>
                <p>Nome, resumo e tipo do item comercial.</p>
              </div>
            </div>
            <div className="billing-catalog-modal__grid billing-catalog-modal__grid--identity">
              <FormField label="Nome do item" className="billing-view__field">
                <TextInput
                  value={catalogItemName}
                  onChange={(e) => onCatalogItemNameChange(e.target.value)}
                  placeholder="Ex.: Consultoria mensal"
                  autoFocus
                  required
                />
              </FormField>

              <FormField label="Tipo" className="billing-view__field">
                <Select value={catalogItemKind} onChange={(e) => onCatalogItemKindChange(e.target.value as ConnectCatalogItemKind)}>
                  <option value="SERVICE">Serviço</option>
                  <option value="PRODUCT">Produto</option>
                </Select>
              </FormField>

              <FormField label="Descrição" className="billing-view__field billing-catalog-modal__field--wide">
                <Textarea
                  value={catalogItemDescription}
                  onChange={(e) => onCatalogItemDescriptionChange(e.target.value)}
                  placeholder="Resumo claro do que será entregue ou cobrado"
                  rows={3}
                  required
                />
              </FormField>
            </div>
          </section>

          <section className="billing-catalog-modal__section">
            <div className="billing-catalog-modal__section-head">
              <span>02</span>
              <div>
                <h3>Cobrança</h3>
                <p>Preço, recorrência e condições comerciais.</p>
              </div>
            </div>
            <div className="billing-catalog-modal__grid">
              <FormField label="Preço" className="billing-view__field">
                <TextInput
                  value={catalogItemAmount}
                  onChange={(e) => onCatalogItemAmountChange(e.target.value)}
                  placeholder="249.90"
                  inputMode="decimal"
                  required
                />
              </FormField>

              <FormField label="Moeda" className="billing-view__field">
                <TextInput value="BRL" readOnly aria-readonly="true" />
              </FormField>

              <FormField label="Modelo" className="billing-view__field">
                <Select
                  value={catalogItemBillingType}
                  onChange={(e) => onCatalogItemBillingTypeChange(e.target.value as ConnectCatalogBillingType)}
                >
                  <option value="ONE_TIME">Cobrança avulsa</option>
                  <option value="ASSINATURA">Assinatura (cartão)</option>
                </Select>
              </FormField>

              <FormField label="Recorrência" className="billing-view__field">
                {isRecurring ? (
                  <Select
                    value={`${catalogItemRecurringInterval}:${catalogItemRecurringIntervalCount}`}
                    onChange={(e) => {
                      const [interval, intervalCount] = e.target.value.split(":");
                      onCatalogItemRecurringChange(interval as ConnectCatalogRecurringInterval, Number(intervalCount));
                    }}
                  >
                    <option value="MONTH:1">Mensal</option>
                    <option value="MONTH:6">Semestral</option>
                    <option value="YEAR:1">Anual</option>
                    <option value="WEEK:1">Semanal</option>
                    <option value="DAY:1">Diária</option>
                  </Select>
                ) : (
                  <TextInput value="Não recorrente" readOnly aria-readonly="true" />
                )}
              </FormField>

              <FormField label="Unidade" className="billing-view__field">
                <TextInput
                  value={catalogItemUnit}
                  onChange={(e) => onCatalogItemUnitChange(e.target.value)}
                  placeholder="serviço, hora, projeto, licença"
                  required
                />
              </FormField>

              <FormField label="Quantidade padrão" className="billing-view__field">
                <TextInput
                  value={catalogItemQuantity}
                  onChange={(e) => onCatalogItemQuantityChange(e.target.value)}
                  placeholder="1"
                  required
                />
              </FormField>

              <FormField label="Prazo de entrega" className="billing-view__field">
                <TextInput
                  value={catalogItemDeliveryTerms}
                  onChange={(e) => onCatalogItemDeliveryTermsChange(e.target.value)}
                  placeholder="Até 10 dias úteis após aprovação"
                  required
                />
              </FormField>

              <FormField label="Condições de pagamento" className="billing-view__field">
                <TextInput
                  value={catalogItemPaymentTerms}
                  onChange={(e) => onCatalogItemPaymentTermsChange(e.target.value)}
                  placeholder="50% na aprovação e 50% na entrega"
                  required
                />
              </FormField>

              <FormField label="Validade do orçamento" className="billing-view__field">
                <TextInput
                  value={catalogItemProposalValidity}
                  onChange={(e) => onCatalogItemProposalValidityChange(e.target.value)}
                  placeholder="15 dias"
                  required
                />
              </FormField>

              <FormField label="Vigência do contrato" className="billing-view__field">
                <TextInput
                  value={catalogItemContractTerm}
                  onChange={(e) => onCatalogItemContractTermChange(e.target.value)}
                  placeholder="12 meses, renovação mensal"
                  required
                />
              </FormField>
            </div>
          </section>

          <section className="billing-catalog-modal__section">
            <div className="billing-catalog-modal__section-head">
              <span>03</span>
              <div>
                <h3>Configurações adicionais</h3>
                <p>Escopo, entregáveis, aceite e regras contratuais.</p>
              </div>
            </div>
            <div className="billing-catalog-modal__grid billing-catalog-modal__grid--textarea">
              <FormField label="Escopo" className="billing-view__field">
                <Textarea
                  value={catalogItemScope}
                  onChange={(e) => onCatalogItemScopeChange(e.target.value)}
                  placeholder="Atividades incluídas, limites e premissas"
                  rows={3}
                  required
                />
              </FormField>

              <FormField label="Entregáveis" className="billing-view__field">
                <Textarea
                  value={catalogItemDeliverables}
                  onChange={(e) => onCatalogItemDeliverablesChange(e.target.value)}
                  placeholder="Itens, arquivos, acessos ou resultados entregues"
                  rows={3}
                  required
                />
              </FormField>

              <FormField label="Responsabilidades do cliente" className="billing-view__field">
                <Textarea
                  value={catalogItemClientResponsibilities}
                  onChange={(e) => onCatalogItemClientResponsibilitiesChange(e.target.value)}
                  placeholder="Informações, aprovações, materiais e acessos necessários"
                  rows={3}
                  required
                />
              </FormField>

              <FormField label="Critérios de aceite" className="billing-view__field">
                <Textarea
                  value={catalogItemAcceptanceCriteria}
                  onChange={(e) => onCatalogItemAcceptanceCriteriaChange(e.target.value)}
                  placeholder="Como a entrega será considerada aceita"
                  rows={3}
                  required
                />
              </FormField>

              <FormField label="Cancelamento / rescisão" className="billing-view__field">
                <Textarea
                  value={catalogItemCancellationTerms}
                  onChange={(e) => onCatalogItemCancellationTermsChange(e.target.value)}
                  placeholder="Prazos, multas, reembolsos e encerramento"
                  rows={3}
                  required
                />
              </FormField>

              <FormField label="Observações contratuais" className="billing-view__field">
                <Textarea
                  value={catalogItemContractNotes}
                  onChange={(e) => onCatalogItemContractNotesChange(e.target.value)}
                  placeholder="Garantias, exclusões, impostos ou regras específicas"
                  rows={3}
                />
              </FormField>
            </div>
          </section>
        </div>

        <footer className="billing-catalog-modal__footer">
          <div className="billing-catalog-modal__feedback">
            {catalogError ? <InlineAlert tone="danger">{catalogError}</InlineAlert> : null}
          </div>
          <div className="billing-catalog-modal__actions">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isCreatingCatalogItem}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isCreatingCatalogItem || !canCreateCatalogItem}
              loading={isCreatingCatalogItem}
            >
              {isCreatingCatalogItem ? "Salvando..." : isEditMode ? "Salvar alterações" : "Salvar item"}
            </Button>
          </div>
        </footer>
      </form>
    </ModalShell>
  );
}
