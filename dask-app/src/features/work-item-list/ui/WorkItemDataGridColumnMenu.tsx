import type { WorkItemListColumnConfig, WorkItemListConfig } from "@/modules/work-item-list";
import { AppDropdownMenu, AppIcon, Button } from "@/shared/ui";

interface WorkItemDataGridColumnMenuProps {
  config: WorkItemListConfig;
  onConfigChange?: (config: WorkItemListConfig) => void;
}

function toggleColumn(config: WorkItemListConfig, column: WorkItemListColumnConfig): WorkItemListConfig {
  return {
    ...config,
    columns: config.columns.map((entry) =>
      entry.id === column.id && !entry.required
        ? { ...entry, visible: !entry.visible }
        : entry
    ),
    updatedAt: new Date().toISOString()
  };
}

export function WorkItemDataGridColumnMenu({ config, onConfigChange }: WorkItemDataGridColumnMenuProps) {
  const configurableColumns = config.columns.filter((column) => column.id !== "actions");

  return (
    <AppDropdownMenu
      trigger={
        <Button type="button" variant="outline" size="sm" className="work-item-data-grid__toolbar-button">
          <AppIcon name="table" size={14} />
          Colunas
        </Button>
      }
      items={configurableColumns.map((column) => ({
        id: column.id,
        label: `${column.visible ? "[x] " : ""}${column.label}`,
        disabled: column.required,
        onSelect: () => onConfigChange?.(toggleColumn(config, column))
      }))}
    />
  );
}
