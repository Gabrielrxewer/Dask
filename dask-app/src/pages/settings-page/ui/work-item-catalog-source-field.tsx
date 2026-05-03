import { FormField } from "@/shared/ui";

export function CatalogSourceField() {
  return (
    <FormField label="Fonte das opções">
      <select
        className="wie__props-select"
        value="billing_catalog_item"
        onChange={() => undefined}
      >
        <option value="billing_catalog_item">Catálogo de cobrança</option>
      </select>
    </FormField>
  );
}
