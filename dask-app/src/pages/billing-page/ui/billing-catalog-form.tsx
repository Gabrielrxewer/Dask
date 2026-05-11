import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import {
  billingCatalogItemFormSchema,
  normalizeMoneyInput,
  type BillingCatalogItemFormValues,
  type ConnectCatalogBillingType,
  type ConnectCatalogItemKind,
  type ConnectCatalogRecurringInterval
} from "@/modules/billing";
import {
  AppDialog,
  AppForm,
  AppFormActions,
  AppFormField,
  AppFormGrid,
  AppFormSection,
  AppIcon,
  AppMoneyField,
  AppSelect,
  AppSelectField,
  AppTextField,
  AppTextareaField,
  Button
} from "@/shared/ui";
import { isRecurringCatalogBillingType } from "./billing-page.model";

export interface BillingCatalogFormProps {
  mode: "create" | "edit";
  initialValues: BillingCatalogItemFormValues;
  isCreatingCatalogItem: boolean;
  onCancel: () => void;
  onSubmit: (values: BillingCatalogItemFormValues) => void | Promise<void>;
}

export function BillingCatalogForm({
  mode,
  initialValues,
  isCreatingCatalogItem,
  onCancel,
  onSubmit
}: BillingCatalogFormProps) {
  const titleId = "billing-catalog-form-title";
  const isEditMode = mode === "edit";
  const form = useForm<BillingCatalogItemFormValues>({
    resolver: zodResolver(billingCatalogItemFormSchema) as Resolver<BillingCatalogItemFormValues>,
    defaultValues: initialValues,
    mode: "onChange"
  });
  const { errors } = form.formState;
  const billingType = form.watch("billingType");
  const recurringInterval = form.watch("recurringInterval") ?? "MONTH";
  const recurringIntervalCount = form.watch("recurringIntervalCount") ?? 1;
  const isRecurring = isRecurringCatalogBillingType(billingType);

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  return (
    <AppDialog
      open
      title={isEditMode ? "Editar item do catalogo" : "Novo item do catalogo"}
      onOpenChange={(open) => {
        if (!open && !isCreatingCatalogItem) onCancel();
      }}
      showClose={false}
      className="billing-catalog-modal"
      contentClassName="billing-catalog-modal__dialog-frame"
    >
      <AppForm
        form={form}
        className="billing-catalog-modal__surface"
        disabled={isCreatingCatalogItem}
        onSubmit={onSubmit}
      >
        <input type="hidden" {...form.register("currency")} />
        <header className="billing-catalog-modal__header">
          <div className="billing-catalog-modal__heading">
            <p>{isEditMode ? "Editar cadastro" : "Novo cadastro"}</p>
            <h2 id={titleId}>{isEditMode ? "Editar item do catalogo" : "Novo item do catalogo"}</h2>
            <span>Defina as informacoes comerciais usadas em cobranca, orcamento, proposta e contrato.</span>
          </div>
          <button
            type="button"
            className="billing-catalog-modal__close"
            onClick={onCancel}
            disabled={isCreatingCatalogItem}
            aria-label="Fechar formulario"
          >
            <AppIcon name="x" size={15} />
          </button>
        </header>

        <div className="billing-catalog-modal__body">
          <AppFormSection className="billing-catalog-modal__section">
            <div className="billing-catalog-modal__section-head">
              <span>01</span>
              <div>
                <h3>Identificacao</h3>
                <p>Nome, resumo e tipo do item comercial.</p>
              </div>
            </div>
            <AppFormGrid className="billing-catalog-modal__grid billing-catalog-modal__grid--identity">
              <AppTextField
                name="name"
                label="Nome do item"
                className="billing-view__field"
                placeholder="Ex.: Consultoria mensal"
                autoFocus
              />
              <AppSelectField<BillingCatalogItemFormValues, "kind", ConnectCatalogItemKind>
                name="kind"
                label="Tipo"
                className="billing-view__field"
                options={[
                  { value: "SERVICE", label: "Servico" },
                  { value: "PRODUCT", label: "Produto" }
                ]}
              />
              <AppTextareaField
                name="description"
                label="Descricao"
                className="billing-view__field billing-catalog-modal__field--wide"
                placeholder="Resumo claro do que sera entregue ou cobrado"
                rows={3}
              />
            </AppFormGrid>
          </AppFormSection>

          <AppFormSection className="billing-catalog-modal__section">
            <div className="billing-catalog-modal__section-head">
              <span>02</span>
              <div>
                <h3>Cobranca</h3>
                <p>Preco, recorrencia e condicoes comerciais.</p>
              </div>
            </div>
            <AppFormGrid className="billing-catalog-modal__grid">
              <AppMoneyField
                name="amount"
                label="Preco"
                className="billing-view__field"
                placeholder="249.90"
                normalizeOnBlur={normalizeMoneyInput}
              />
              <AppTextField
                name="currency"
                label="Moeda"
                className="billing-view__field"
                readOnly
                aria-readonly="true"
              />
              <AppSelectField<BillingCatalogItemFormValues, "billingType", ConnectCatalogBillingType>
                name="billingType"
                label="Modelo"
                className="billing-view__field"
                options={[
                  { value: "ONE_TIME", label: "Cobranca avulsa" },
                  { value: "ASSINATURA", label: "Assinatura (cartao)" }
                ]}
                onValueChange={(value) => {
                  if (isRecurringCatalogBillingType(value)) {
                    form.setValue("recurringInterval", form.getValues("recurringInterval") ?? "MONTH", { shouldValidate: true });
                    form.setValue("recurringIntervalCount", form.getValues("recurringIntervalCount") ?? 1, { shouldValidate: true });
                  } else {
                    form.setValue("recurringInterval", undefined, { shouldValidate: true });
                    form.setValue("recurringIntervalCount", undefined, { shouldValidate: true });
                  }
                }}
              />
              {isRecurring ? (
                <AppFormField
                  label="Recorrencia"
                  className="billing-view__field"
                  error={typeof errors.recurringInterval?.message === "string" ? errors.recurringInterval.message : undefined}
                >
                  <AppSelect
                    value={`${recurringInterval}:${recurringIntervalCount}`}
                    onValueChange={(value) => {
                      const [interval, intervalCount] = value.split(":");
                      form.setValue("recurringInterval", interval as ConnectCatalogRecurringInterval, { shouldValidate: true });
                      form.setValue("recurringIntervalCount", Number(intervalCount), { shouldValidate: true });
                    }}
                    aria-label="Recorrencia"
                    items={[
                      { value: "MONTH:1", label: "Mensal" },
                      { value: "MONTH:6", label: "Semestral" },
                      { value: "YEAR:1", label: "Anual" },
                      { value: "WEEK:1", label: "Semanal" },
                      { value: "DAY:1", label: "Diaria" }
                    ]}
                  />
                </AppFormField>
              ) : (
                <AppTextField
                  name="recurringInterval"
                  label="Recorrencia"
                  className="billing-view__field"
                  formatValue={() => "Nao recorrente"}
                  readOnly
                  aria-readonly="true"
                />
              )}
              <AppTextField name="unit" label="Unidade" className="billing-view__field" placeholder="servico, hora, projeto, licenca" />
              <AppTextField name="defaultQuantity" label="Quantidade padrao" className="billing-view__field" placeholder="1" />
              <AppTextField name="deliveryTerms" label="Prazo de entrega" className="billing-view__field" placeholder="Ate 10 dias uteis apos aprovacao" />
              <AppTextField name="paymentTerms" label="Condicoes de pagamento" className="billing-view__field" placeholder="50% na aprovacao e 50% na entrega" />
              <AppTextField name="proposalValidity" label="Validade do orcamento" className="billing-view__field" placeholder="15 dias" />
              <AppTextField name="contractTerm" label="Vigencia do contrato" className="billing-view__field" placeholder="12 meses, renovacao mensal" />
            </AppFormGrid>
          </AppFormSection>

          <AppFormSection className="billing-catalog-modal__section">
            <div className="billing-catalog-modal__section-head">
              <span>03</span>
              <div>
                <h3>Configuracoes adicionais</h3>
                <p>Escopo, entregaveis, aceite e regras contratuais.</p>
              </div>
            </div>
            <AppFormGrid className="billing-catalog-modal__grid billing-catalog-modal__grid--textarea">
              <AppTextareaField name="scope" label="Escopo" className="billing-view__field" placeholder="Atividades incluidas, limites e premissas" rows={3} />
              <AppTextareaField name="deliverables" label="Entregaveis" className="billing-view__field" placeholder="Itens, arquivos, acessos ou resultados entregues" rows={3} />
              <AppTextareaField name="clientResponsibilities" label="Responsabilidades do cliente" className="billing-view__field" placeholder="Informacoes, aprovacoes, materiais e acessos necessarios" rows={3} />
              <AppTextareaField name="acceptanceCriteria" label="Criterios de aceite" className="billing-view__field" placeholder="Como a entrega sera considerada aceita" rows={3} />
              <AppTextareaField name="cancellationTerms" label="Cancelamento / rescisao" className="billing-view__field" placeholder="Prazos, multas, reembolsos e encerramento" rows={3} />
              <AppTextareaField name="contractNotes" label="Observacoes contratuais" className="billing-view__field" placeholder="Garantias, exclusoes, impostos ou regras especificas" rows={3} />
            </AppFormGrid>
          </AppFormSection>
        </div>

        <footer className="billing-catalog-modal__footer">
          <AppFormActions className="billing-catalog-modal__actions">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isCreatingCatalogItem}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isCreatingCatalogItem || !form.formState.isValid}
              loading={isCreatingCatalogItem}
            >
              {isCreatingCatalogItem ? "Salvando..." : isEditMode ? "Salvar alteracoes" : "Salvar item"}
            </Button>
          </AppFormActions>
        </footer>
      </AppForm>
    </AppDialog>
  );
}
