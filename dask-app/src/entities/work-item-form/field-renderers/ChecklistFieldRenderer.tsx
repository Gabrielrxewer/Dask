import { FieldFrame } from "./FieldFrame";
import type { WorkItemFieldRendererProps } from "./field-renderer-registry";

export function ChecklistFieldRenderer({ field, value, error }: WorkItemFieldRendererProps) {
  const items = Array.isArray(value) ? value : [];
  return (
    <FieldFrame label={field.label} description={field.description} error={error}>
      <div className="work-item-form-options">
        {items.length === 0 ? <span>Nenhum item</span> : items.map((item, index) => {
          const record = item && typeof item === "object" ? item as { id?: string; label?: string; done?: boolean } : {};
          return <span key={record.id ?? index}>{record.done ? "[x]" : "[ ]"} {record.label ?? "Checklist"}</span>;
        })}
      </div>
    </FieldFrame>
  );
}

