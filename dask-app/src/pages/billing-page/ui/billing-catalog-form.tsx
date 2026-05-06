import type {
  ConnectCatalogBillingType,
  ConnectCatalogItemKind,
  ConnectCatalogRecurringInterval
} from "@/modules/billing";
import { Button, FormField, InlineAlert, Select, Textarea, TextInput } from "@/shared/ui";
import { isRecurringCatalogBillingType } from "./billing-page.model";

export interface BillingCatalogFormProps {
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
  onSubmit: () => void | Promise<void>;
}

export function BillingCatalogForm({
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
  onSubmit
}: BillingCatalogFormProps) {
  return (
    <div className="billing-view__catalog-create">
      <div className="billing-view__form-grid shared-form-grid shared-form-grid--two">
        <FormField label="Tipo" className="billing-view__field">
          <Select value={catalogItemKind} onChange={(e) => onCatalogItemKindChange(e.target.value as ConnectCatalogItemKind)}>
            <option value="SERVICE">Serviço</option>
            <option value="PRODUCT">Produto</option>
          </Select>
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
      </div>

      <div className="billing-view__form-grid shared-form-grid shared-form-grid--two">
        <FormField label="Nome" className="billing-view__field">
          <TextInput
            value={catalogItemName}
            onChange={(e) => onCatalogItemNameChange(e.target.value)}
            placeholder="Ex.: Consultoria mensal"
          />
        </FormField>

        {isRecurringCatalogBillingType(catalogItemBillingType) ? (
          <FormField label="Recorrência" className="billing-view__field">
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
          </FormField>
        ) : (
          <FormField label="Recorrência" className="billing-view__field">
            <TextInput value="Não recorrente" readOnly />
          </FormField>
        )}
      </div>

      <div className="billing-view__form-grid shared-form-grid shared-form-grid--two">
        <FormField label="Valor (R$)" className="billing-view__field">
          <TextInput
            value={catalogItemAmount}
            onChange={(e) => onCatalogItemAmountChange(e.target.value)}
            placeholder="249.90"
          />
        </FormField>

        <FormField label="Resumo" className="billing-view__field">
          <TextInput
            value={catalogItemDescription}
            onChange={(e) => onCatalogItemDescriptionChange(e.target.value)}
            placeholder="Escopo resumido do item"
          />
        </FormField>
      </div>

      <div className="billing-view__form-grid shared-form-grid shared-form-grid--two">
        <FormField label="Unidade" className="billing-view__field">
          <TextInput
            value={catalogItemUnit}
            onChange={(e) => onCatalogItemUnitChange(e.target.value)}
            placeholder="serviço, hora, projeto, licença"
          />
        </FormField>

        <FormField label="Quantidade padrão" className="billing-view__field">
          <TextInput
            value={catalogItemQuantity}
            onChange={(e) => onCatalogItemQuantityChange(e.target.value)}
            placeholder="1"
          />
        </FormField>
      </div>

      <div className="billing-view__form-grid shared-form-grid shared-form-grid--two">
        <FormField label="Prazo / entrega" className="billing-view__field">
          <TextInput
            value={catalogItemDeliveryTerms}
            onChange={(e) => onCatalogItemDeliveryTermsChange(e.target.value)}
            placeholder="Ex.: até 10 dias úteis após aprovação"
          />
        </FormField>

        <FormField label="Condições de pagamento" className="billing-view__field">
          <TextInput
            value={catalogItemPaymentTerms}
            onChange={(e) => onCatalogItemPaymentTermsChange(e.target.value)}
            placeholder="Ex.: 50% na aprovação e 50% na entrega"
          />
        </FormField>
      </div>

      <div className="billing-view__form-grid shared-form-grid shared-form-grid--two">
        <FormField label="Validade do orçamento" className="billing-view__field">
          <TextInput
            value={catalogItemProposalValidity}
            onChange={(e) => onCatalogItemProposalValidityChange(e.target.value)}
            placeholder="Ex.: 15 dias"
          />
        </FormField>

        <FormField label="Vigência do contrato" className="billing-view__field">
          <TextInput
            value={catalogItemContractTerm}
            onChange={(e) => onCatalogItemContractTermChange(e.target.value)}
            placeholder="Ex.: 12 meses, renovação mensal"
          />
        </FormField>
      </div>

      <div className="billing-view__form-grid billing-view__form-grid--stack shared-form-grid shared-form-grid--two shared-form-grid--stack">
        <FormField label="Escopo" className="billing-view__field">
          <Textarea
            value={catalogItemScope}
            onChange={(e) => onCatalogItemScopeChange(e.target.value)}
            placeholder="Atividades incluídas, limites e premissas"
            rows={3}
          />
        </FormField>

        <FormField label="Entregáveis" className="billing-view__field">
          <Textarea
            value={catalogItemDeliverables}
            onChange={(e) => onCatalogItemDeliverablesChange(e.target.value)}
            placeholder="Itens, arquivos, acessos ou resultados entregues"
            rows={3}
          />
        </FormField>
      </div>

      <div className="billing-view__form-grid billing-view__form-grid--stack shared-form-grid shared-form-grid--two shared-form-grid--stack">
        <FormField label="Responsabilidades do cliente" className="billing-view__field">
          <Textarea
            value={catalogItemClientResponsibilities}
            onChange={(e) => onCatalogItemClientResponsibilitiesChange(e.target.value)}
            placeholder="Informações, aprovações, materiais e acessos necessários"
            rows={3}
          />
        </FormField>

        <FormField label="Critérios de aceite" className="billing-view__field">
          <Textarea
            value={catalogItemAcceptanceCriteria}
            onChange={(e) => onCatalogItemAcceptanceCriteriaChange(e.target.value)}
            placeholder="Como a entrega será considerada aceita"
            rows={3}
          />
        </FormField>
      </div>

      <div className="billing-view__form-grid billing-view__form-grid--stack shared-form-grid shared-form-grid--two shared-form-grid--stack">
        <FormField label="Cancelamento / rescisão" className="billing-view__field">
          <Textarea
            value={catalogItemCancellationTerms}
            onChange={(e) => onCatalogItemCancellationTermsChange(e.target.value)}
            placeholder="Prazos, multas, reembolsos e encerramento"
            rows={3}
          />
        </FormField>

        <FormField label="Observações contratuais (opcional)" className="billing-view__field">
          <Textarea
            value={catalogItemContractNotes}
            onChange={(e) => onCatalogItemContractNotesChange(e.target.value)}
            placeholder="Garantias, exclusões, impostos ou regras específicas"
            rows={3}
          />
        </FormField>
      </div>

      <div className="billing-view__actions shared-actions-row">
        <Button
          type="button"
          onClick={() => void onSubmit()}
          disabled={isCreatingCatalogItem || !canCreateCatalogItem}
        >
          {isCreatingCatalogItem ? "Salvando..." : "Adicionar ao catálogo"}
        </Button>
      </div>
      {catalogError ? <InlineAlert tone="danger">{catalogError}</InlineAlert> : null}
    </div>
  );
}
