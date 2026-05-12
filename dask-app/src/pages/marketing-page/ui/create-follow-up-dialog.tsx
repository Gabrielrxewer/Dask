import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { CreateMarketingFollowUpValues, MarketingSignal } from "@/modules/marketing";
import { createMarketingFollowUpSchema } from "@/modules/marketing";
import {
  AppCheckboxField,
  AppDateTimeField,
  AppDialog,
  AppForm,
  AppFormActions,
  AppFormGrid,
  AppSelectField,
  AppTextField,
  AppTextareaField,
  Button
} from "@/shared/ui";

const PRIORITY_ITEMS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" }
] as const;

interface CreateFollowUpDialogProps {
  signal: MarketingSignal | null;
  open: boolean;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateMarketingFollowUpValues) => Promise<void>;
}

type CreateMarketingFollowUpFormValues = z.input<typeof createMarketingFollowUpSchema>;

function buildDefaults(signal: MarketingSignal | null): CreateMarketingFollowUpValues {
  const contactName = signal?.workItem?.contactName ?? signal?.workItem?.email ?? "contato";
  return {
    signalId: signal?.id ?? "00000000-0000-0000-0000-000000000000",
    workItemId: signal?.workItemId ?? signal?.workItem?.id ?? "00000000-0000-0000-0000-000000000000",
    title: `Follow-up com ${contactName}`,
    description: signal?.headline ?? signal?.description ?? "",
    dueAt: null,
    priority: "medium",
    createWorkItem: true
  };
}

export function CreateFollowUpDialog({
  signal,
  open,
  isSubmitting = false,
  onOpenChange,
  onCreate
}: CreateFollowUpDialogProps) {
  const defaultValues = useMemo(() => buildDefaults(signal), [signal]);
  const form = useForm<CreateMarketingFollowUpFormValues, unknown, CreateMarketingFollowUpValues>({
    resolver: zodResolver(createMarketingFollowUpSchema),
    defaultValues
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const contactName = signal?.workItem?.contactName ?? signal?.workItem?.email ?? "Contato desconhecido";

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Criar follow-up"
      description={contactName}
      contentClassName="mkt-follow-up-dialog"
    >
      <AppForm<CreateMarketingFollowUpFormValues, CreateMarketingFollowUpValues>
        form={form}
        className="mkt-follow-up-dialog__form"
        disabled={isSubmitting}
        onSubmit={async (values) => {
          await onCreate(values);
          onOpenChange(false);
        }}
      >
        <AppTextField name="title" label="Titulo" autoFocus />
        <AppTextareaField name="description" label="Descricao" rows={5} />

        <AppFormGrid className="marketing-page__grid" columns={2}>
          <AppDateTimeField name="dueAt" label="Data" placeholder="Selecionar data" />
          <AppSelectField
            name="priority"
            label="Prioridade"
            options={[...PRIORITY_ITEMS]}
            formatValue={(value) => (typeof value === "string" && value.length > 0 ? value : "medium")}
          />
        </AppFormGrid>

        <AppCheckboxField name="createWorkItem" label="Criar item no board" />

        <AppFormActions className="mkt-follow-up-dialog__actions">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || !signal?.workItemId}>
            {isSubmitting ? "Criando..." : "Criar follow-up"}
          </Button>
        </AppFormActions>
      </AppForm>
    </AppDialog>
  );
}
