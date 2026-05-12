import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { TaskFieldDefinition } from "@/entities/task";
import type { ConnectCatalogItem } from "@/modules/billing";
import { normalizeMoneyInput } from "@/modules/billing";
import {
  useCreateCommercialWorkItemMutation,
  useCreateCustomerMutation,
  useCreateSignalWorkItemMutation
} from "@/modules/commercial";
import {
  commercialWorkItemFormSchema,
  type CommercialWorkItemFormValues
} from "@/modules/commercial/model";
import { getCustomerDisplayName, type Customer } from "@/modules/workspace";
import {
  AppDateField,
  AppDialog,
  AppForm,
  AppFormActions,
  AppFormGrid,
  AppMoneyField,
  AppSelectField,
  AppTextField,
  AppTextareaField,
  Button,
  toast
} from "@/shared/ui";
import {
  submitCommercialWorkItem,
  type CommercialWorkItemKind
} from "./commercial-work-item-dialog.model";
import type { CommercialWorkItemFormState } from "./commercial-page.model";

const EMPTY_VALUE = "__empty__";

export interface CommercialWorkItemDialogProps {
  open: boolean;
  mode: CommercialWorkItemKind;
  workspaceId: string | null | undefined;
  defaultValues: CommercialWorkItemFormState;
  customers: Customer[];
  catalogItems: ConnectCatalogItem[];
  catalogItemsById: Map<string, ConnectCatalogItem>;
  fieldDefinitions: TaskFieldDefinition[];
  commercialTypeId: string;
  signalTypeId: string;
  initialStatusId: string;
  signalInitialStatusId: string;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CommercialWorkItemDialog({
  open,
  mode,
  workspaceId,
  defaultValues,
  customers,
  catalogItems,
  catalogItemsById,
  fieldDefinitions,
  commercialTypeId,
  signalTypeId,
  initialStatusId,
  signalInitialStatusId,
  onOpenChange,
  onCreated
}: CommercialWorkItemDialogProps) {
  const form = useForm<CommercialWorkItemFormValues>({
    resolver: zodResolver(commercialWorkItemFormSchema),
    defaultValues,
    mode: "onBlur"
  });
  const createCustomerMutation = useCreateCustomerMutation(workspaceId, { silent: true });
  const createCommercialWorkItemMutation = useCreateCommercialWorkItemMutation(workspaceId, { silent: true });
  const createSignalWorkItemMutation = useCreateSignalWorkItemMutation(workspaceId, { silent: true });
  const isSignal = mode === "signal";
  const formId = isSignal ? "signal-work-item-form" : "commercial-work-item-form";
  const isSubmitting =
    form.formState.isSubmitting ||
    createCustomerMutation.isPending ||
    createCommercialWorkItemMutation.isPending ||
    createSignalWorkItemMutation.isPending;

  useEffect(() => {
    if (open) form.reset(defaultValues);
  }, [defaultValues, form, open]);

  const closeDialog = () => {
    if (!isSubmitting) onOpenChange(false);
  };

  const handleSubmit = async (values: CommercialWorkItemFormValues) => {
    try {
      const mutation = isSignal ? createSignalWorkItemMutation : createCommercialWorkItemMutation;

      await submitCommercialWorkItem(
        values,
        {
          kind: mode,
          commercialTypeId,
          signalTypeId,
          initialStatusId,
          signalInitialStatusId,
          fieldDefinitions,
          catalogItemsById
        },
        {
          customers,
          createCustomer: (input) => createCustomerMutation.mutateAsync(input),
          createWorkItem: (input) => mutation.mutateAsync(input)
        }
      );

      toast.success(isSignal ? "Signal criado como WorkItem comercial." : "WorkItem comercial criado.");
      onOpenChange(false);
      onCreated?.();
    } catch (error) {
      toast.error("Falha ao criar WorkItem comercial.", {
        description: error instanceof Error ? error.message : "Tente novamente."
      });
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true);
          return;
        }
        closeDialog();
      }}
      title={isSignal ? "Novo Signal comercial" : "Novo WorkItem comercial"}
      showClose={!isSubmitting}
      className="commercial-page__modal"
      contentClassName="commercial-page__modal-content"
      footer={(
        <AppFormActions className="commercial-page__row-actions">
          <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={isSubmitting}>
            {isSignal ? "Criar Signal" : "Criar WorkItem"}
          </Button>
        </AppFormActions>
      )}
    >
      <AppForm
        id={formId}
        form={form}
        disabled={isSubmitting}
        onSubmit={handleSubmit}
        className="commercial-page__modal-form"
      >
        <AppFormGrid className="commercial-page__form-grid" columns={3}>
          <AppSelectField
            name="customerId"
            label="Cliente vinculado"
            placeholder="Sem cliente vinculado"
            options={[
              { value: EMPTY_VALUE, label: "Sem cliente vinculado" },
              ...customers.map((customer) => ({
                value: customer.id,
                label: getCustomerDisplayName(customer)
              }))
            ]}
            formatValue={(value) => (typeof value === "string" && value.length > 0 ? value : EMPTY_VALUE)}
            parseValue={(value) => (value === EMPTY_VALUE ? "" : value)}
          />
          <AppTextField name="companyName" label="Empresa" autoFocus />
          <AppTextField name="contactName" label="Contato" />
        </AppFormGrid>

        <AppFormGrid className="commercial-page__form-grid" columns={3}>
          <AppTextField name="contactEmail" label="E-mail" />
          <AppTextField name="contactPhone" label="Telefone" />
          <AppTextField name="source" label="Origem" />
        </AppFormGrid>

        <AppFormGrid className="commercial-page__form-grid" columns={3}>
          <AppMoneyField
            name="estimatedValue"
            label="Valor estimado (R$)"
            placeholder="0,00"
            normalizeOnBlur={normalizeMoneyInput}
          />
          <AppDateField
            name="proposalValidity"
            label="Validade da proposta"
            placeholder="Selecionar data"
            parseValue={(value) => value ?? ""}
          />
        </AppFormGrid>

        <AppSelectField
          name="interest"
          label="Interesse / escopo"
          placeholder="Selecione um item do catalogo"
          options={[
            { value: EMPTY_VALUE, label: "Selecione um item do catalogo" },
            ...catalogItems.map((item) => ({ value: item.id, label: item.name }))
          ]}
          formatValue={(value) => (typeof value === "string" && value.length > 0 ? value : EMPTY_VALUE)}
          parseValue={(value) => (value === EMPTY_VALUE ? "" : value)}
          onValueChange={(_, formValue) => {
            const nextValue = typeof formValue === "string" ? formValue : "";
            const catalogItem = catalogItemsById.get(nextValue);
            if (catalogItem && !form.getValues("estimatedValue")) {
              form.setValue("estimatedValue", String(catalogItem.amount / 100), { shouldDirty: true });
            }
            if (catalogItem?.metadata?.proposalValidity && !form.getValues("proposalValidity")) {
              form.setValue("proposalValidity", catalogItem.metadata.proposalValidity, { shouldDirty: true });
            }
          }}
        />

        <AppTextareaField name="notes" label="Observacoes" rows={3} />
      </AppForm>
    </AppDialog>
  );
}
