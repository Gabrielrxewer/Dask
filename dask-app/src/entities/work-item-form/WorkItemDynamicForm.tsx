import type { FormEventHandler } from "react";
import type { WorkItemLayoutFieldRef, WorkItemPublicSchema } from "@/entities/work-item-schema";
import { WorkItemFieldController } from "@/entities/work-item-form/WorkItemFieldController";
import type { WorkItemPublicField } from "@/entities/work-item-schema";
import {
  resolveWorkItemFormFieldLayout,
  type WorkItemFormLayoutZone
} from "@/entities/work-item-form/workItemFormLayout";
import { cn } from "@/shared/lib/cn";

export interface WorkItemDynamicFormProps {
  schema: WorkItemPublicSchema;
  fields?: WorkItemPublicField[];
  onSubmit?: FormEventHandler<HTMLFormElement>;
  onFieldChange?: (field: WorkItemPublicField, value: unknown) => void;
  className?: string;
  layoutZone?: WorkItemFormLayoutZone;
  readonly?: boolean;
}

function getLayoutFields(schema: WorkItemPublicSchema): WorkItemLayoutFieldRef[] {
  return schema.layouts.form.fields.length > 0 ? schema.layouts.form.fields : schema.layouts.detail.fields;
}

function findFieldByLayoutRef(schema: WorkItemPublicSchema, layoutRef: WorkItemLayoutFieldRef) {
  return schema.fields.find(candidate => {
    const runtimeFieldId =
      candidate.metadata && typeof candidate.metadata.runtimeFieldId === "string" ? candidate.metadata.runtimeFieldId : null;

    return candidate.id === layoutRef.fieldId || candidate.key === layoutRef.fieldId || runtimeFieldId === layoutRef.fieldId;
  });
}

function findLayoutRef(layoutFields: WorkItemLayoutFieldRef[], field: WorkItemPublicField) {
  const runtimeFieldId =
    field.metadata && typeof field.metadata.runtimeFieldId === "string" ? field.metadata.runtimeFieldId : null;

  return layoutFields.find(layoutField =>
    layoutField.fieldId === field.id ||
    layoutField.fieldId === field.key ||
    (runtimeFieldId !== null && layoutField.fieldId === runtimeFieldId)
  );
}

export function WorkItemDynamicForm({
  schema,
  fields,
  onSubmit,
  onFieldChange,
  className,
  layoutZone,
  readonly = false
}: WorkItemDynamicFormProps) {
  const layoutFields = getLayoutFields(schema);
  const formFields = fields
    ? fields.map(field => ({ field, layoutRef: findLayoutRef(layoutFields, field) }))
    : layoutFields.length > 0
      ? layoutFields
          .filter(field => field.visible !== false)
          .sort((left, right) => left.order - right.order)
          .map(layoutRef => ({ field: findFieldByLayoutRef(schema, layoutRef), layoutRef }))
          .filter((entry): entry is { field: WorkItemPublicField; layoutRef: WorkItemLayoutFieldRef } => Boolean(entry.field))
      : schema.fields.map(field => ({ field, layoutRef: undefined }));

  return (
    <form className={cn("work-item-dynamic-form", className)} onSubmit={onSubmit}>
      {formFields
        .filter(({ field }) => field.visibility !== "hidden")
        .map(({ field, layoutRef }) => {
          const layout = resolveWorkItemFormFieldLayout(field, layoutRef, layoutZone);

          return (
            <div
              key={field.id}
              className={cn(
                "work-item-form-slot",
                `work-item-form-slot--${layout.span}`,
                `work-item-form-slot--${layout.zone}`
              )}
              data-field-id={field.id}
              data-field-key={field.key}
              data-field-type={field.type}
              data-form-zone={layout.zone}
              data-form-span={layout.span}
            >
              <WorkItemFieldController field={field} readonly={readonly} onFieldChange={onFieldChange} />
            </div>
          );
        })}
    </form>
  );
}
