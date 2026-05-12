import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import type { Task } from "@/entities/task";
import { buildWorkItemTypeTransformationSchema, type WorkItemTypeTransformationValues } from "@/modules/commercial/model";
import type { WorkItemTypeTransformationField, WorkItemTypeTransformationSummary } from "@/modules/workspace";
import { AppDialog, AppForm, AppFormActions, AppFormGrid, AppTextField, Button, StatusBadge } from "@/shared/ui";

function hasUsableDefault(field: WorkItemTypeTransformationField): boolean {
  const value = field.defaultValue;
  return value !== undefined && value !== null && (typeof value !== "string" || value.trim().length > 0);
}

export function getFieldsRequiringTransformationInput(
  transformation: WorkItemTypeTransformationSummary
): WorkItemTypeTransformationField[] {
  return transformation.newRequiredFields.filter((field) => !hasUsableDefault(field));
}

export function buildTransformationDefaultValues(
  transformation: WorkItemTypeTransformationSummary,
  values?: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    transformation.newRequiredFields.map((field) => [
      field.slug,
      values?.[field.slug] ?? values?.[field.id] ?? field.defaultValue ?? ""
    ])
  );
}

export function WorkItemTypeTransformationDialog({
  task,
  transformation,
  isSubmitting,
  onClose,
  onSubmit
}: {
  task: Task;
  transformation: WorkItemTypeTransformationSummary;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: WorkItemTypeTransformationValues) => void;
}) {
  const requiredFields = useMemo(() => getFieldsRequiringTransformationInput(transformation), [transformation]);
  const schema = useMemo(
    () => buildWorkItemTypeTransformationSchema(requiredFields.map((field) => field.slug)),
    [requiredFields]
  );
  const form = useForm<WorkItemTypeTransformationValues>({
    resolver: zodResolver(schema),
    values: {
      workItemId: task.id,
      fromTypeId: transformation.fromTypeId,
      toTypeId: transformation.toTypeId,
      defaultValuesForNewFields: buildTransformationDefaultValues(transformation)
    },
    mode: "onBlur"
  });

  return (
    <AppDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Transformar Signal em WorkItem"
      description="Preencha os campos obrigatorios do tipo destino antes de promover o WorkItem."
      className="commercial-page__modal"
      contentClassName="commercial-page__modal-content"
      footer={(
        <AppFormActions className="commercial-page__row-actions">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="work-item-type-transformation-form" variant="primary" loading={isSubmitting}>
            Transformar em WorkItem
          </Button>
        </AppFormActions>
      )}
    >
      <AppForm
        id="work-item-type-transformation-form"
        form={form}
        onSubmit={(values) => onSubmit(values)}
        disabled={isSubmitting}
        className="commercial-page__modal-form"
      >
        <div className="commercial-page__transformation-summary">
          <div>
            <span className="commercial-page__eyebrow">WorkItem</span>
            <strong>{task.title}</strong>
          </div>
          <StatusBadge tone="info" size="sm">
            {transformation.fromType.name} para {transformation.toType.name}
          </StatusBadge>
        </div>

        {transformation.preservedFields.length > 0 ? (
          <div className="commercial-page__transformation-preview">
            <span className="commercial-page__eyebrow">Campos preservados</span>
            <div>
              {transformation.preservedFields.slice(0, 10).map((field) => (
                <span key={field.id}>{field.name || field.slug}</span>
              ))}
            </div>
          </div>
        ) : null}

        {requiredFields.length > 0 ? (
          <AppFormGrid className="commercial-page__form-grid" columns={2}>
            {requiredFields.map((field, index) => (
              <AppTextField
                key={field.id}
                name={`defaultValuesForNewFields.${field.slug}`}
                label={field.name || field.slug}
                required
                autoFocus={index === 0}
              />
            ))}
          </AppFormGrid>
        ) : null}
      </AppForm>
    </AppDialog>
  );
}
