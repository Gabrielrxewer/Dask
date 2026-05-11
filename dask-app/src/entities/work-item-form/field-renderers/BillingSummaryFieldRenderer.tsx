import { FieldFrame } from "./FieldFrame";
import type { WorkItemFieldRendererProps } from "./field-renderer-registry";

export function BillingSummaryFieldRenderer({ field, value }: WorkItemFieldRendererProps) {
  const currency = field.metadata?.billingSummary?.currency ?? "BRL";
  const amount = typeof value === "number" ? value : 0;
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);

  return (
    <FieldFrame label={field.label} description={field.description}>
      <output className="work-item-form-billing-summary">{formatted}</output>
    </FieldFrame>
  );
}

