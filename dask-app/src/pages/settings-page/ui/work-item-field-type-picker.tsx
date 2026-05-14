import type { CustomFieldType } from "@/modules/workspace/model";
import { AppDialog } from "@/shared/ui/dialog";
import { AppIcon, type AppIconName } from "@/shared/ui/icon";
import { FIELD_TYPE_OPTIONS } from "./work-item-editor-settings.model";

const fieldTypeIconByType: Partial<Record<CustomFieldType, AppIconName>> = {
  text: "file",
  long_text: "documentation",
  number: "trend-up",
  date: "calendar-check",
  datetime: "calendar-check",
  boolean: "square-check",
  select: "list",
  catalog_select: "table",
  multi_select: "list-checks",
  user: "user",
  checklist: "list-checks",
  billing_summary: "billing"
};

function FieldTypePreview({ type }: { type: CustomFieldType }) {
  if (type === "long_text") {
    return (
      <span className="wie__field-type-preview wie__field-type-preview--long-text">
        <i />
        <i />
        <i />
      </span>
    );
  }

  if (type === "number" || type === "billing_summary") {
    return (
      <span className="wie__field-type-preview wie__field-type-preview--number">
        <strong>{type === "billing_summary" ? "R$ 4.820" : "128"}</strong>
        <small>{type === "billing_summary" ? "3 cobrancas" : "+12%"}</small>
      </span>
    );
  }

  if (type === "date" || type === "datetime") {
    return (
      <span className="wie__field-type-preview wie__field-type-preview--date">
        <strong>18</strong>
        <small>{type === "datetime" ? "14:30" : "Mai"}</small>
      </span>
    );
  }

  if (type === "boolean") {
    return (
      <span className="wie__field-type-preview wie__field-type-preview--boolean">
        <i />
      </span>
    );
  }

  if (type === "select" || type === "multi_select" || type === "catalog_select") {
    return (
      <span className="wie__field-type-preview wie__field-type-preview--select">
        <i />
        <i />
        {type !== "select" ? <i /> : null}
      </span>
    );
  }

  if (type === "user") {
    return (
      <span className="wie__field-type-preview wie__field-type-preview--user">
        <i>GA</i>
        <small>Responsavel</small>
      </span>
    );
  }

  if (type === "checklist") {
    return (
      <span className="wie__field-type-preview wie__field-type-preview--checklist">
        <i />
        <i />
        <i />
      </span>
    );
  }

  return (
    <span className="wie__field-type-preview">
      <i />
    </span>
  );
}

interface WorkItemFieldTypePickerProps {
  open: boolean;
  title: string;
  description: string;
  selectedType?: CustomFieldType | null;
  onOpenChange: (open: boolean) => void;
  onSelectType: (type: CustomFieldType) => void;
}

export function WorkItemFieldTypePicker({
  open,
  title,
  description,
  selectedType,
  onOpenChange,
  onSelectType
}: WorkItemFieldTypePickerProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="wie__field-type-dialog"
      bodyClassName="wie__field-type-dialog-body"
      fallbackTitle={title}
    >
      <div className="wie__field-type-grid" role="listbox" aria-label="Tipos de campo">
        {FIELD_TYPE_OPTIONS.map((option) => {
          const isSelected = selectedType === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`wie__field-type-card${isSelected ? " is-selected" : ""}`}
              onClick={() => onSelectType(option.value)}
            >
              <span className="wie__field-type-card-head">
                <span className="wie__field-type-card-icon">
                  <AppIcon name={fieldTypeIconByType[option.value] ?? "file"} size={17} strokeWidth={2} />
                </span>
                {isSelected ? (
                  <span className="wie__field-type-selected">
                    <AppIcon name="check" size={13} strokeWidth={2.4} />
                  </span>
                ) : null}
              </span>
              <FieldTypePreview type={option.value} />
              <span className="wie__field-type-card-copy">
                <strong>{option.label}</strong>
                <small>{option.caption}</small>
              </span>
            </button>
          );
        })}
      </div>
    </AppDialog>
  );
}
