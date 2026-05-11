import { AppSelect, FormField } from "@/shared/ui";

export function CatalogSourceField() {
  return (
    <FormField label="Fonte das opções">
      <AppSelect
        className="wie__props-select"
        value="billing_catalog_item"
        onValueChange={() => undefined}
        aria-label="Fonte das opções"
        items={[{ value: "billing_catalog_item", label: "Catálogo de cobrança" }]}
      />
    </FormField>
  );
}
