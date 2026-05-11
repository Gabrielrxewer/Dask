import { FieldFrame } from "./FieldFrame";
import type { WorkItemFieldRendererProps } from "./field-renderer-registry";

export function MultiSelectFieldRenderer({ field, value, onChange, error, readonly }: WorkItemFieldRendererProps) {
  const selected = new Set(Array.isArray(value) ? value.map(String) : []);
  return (
    <FieldFrame label={field.label} description={field.description} error={error}>
      <div className="work-item-form-options">
        {(field.options ?? []).map(option => (
          <label key={option.value}>
            <input
              type="checkbox"
              checked={selected.has(option.value)}
              disabled={readonly}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(option.value);
                else next.delete(option.value);
                onChange(Array.from(next));
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </FieldFrame>
  );
}

