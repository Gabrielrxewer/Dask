import { FormField } from "@/shared/ui";

export function CatalogSourceField() {
  return (
    <FormField label="Fonte das opÃ§Ãµes">
      <select
        className="wie__props-select"
        value="billing_catalog_item"
        onChange={() => undefined}
      >
        <option value="billing_catalog_item">CatÃ¡logo de cobranÃ§a</option>
      </select>
    </FormField>
  );
}
