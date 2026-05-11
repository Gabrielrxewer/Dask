import { DataTable, DataTableBody, DataTableCell, DataTableHeader, DataTableRow, EmptyState } from "@/shared/ui";
import type { DashboardTableData, DashboardWidget } from "@/modules/dashboard/types";

function isTableData(data: unknown): data is DashboardTableData {
  return Boolean(data) &&
    typeof data === "object" &&
    Array.isArray((data as DashboardTableData).columns) &&
    Array.isArray((data as DashboardTableData).rows);
}

export function TableWidget({ widget }: { widget: DashboardWidget }) {
  const data = isTableData(widget.data) ? widget.data : { columns: [], rows: [] };

  if (data.columns.length === 0 || data.rows.length === 0) {
    return <EmptyState size="compact" variant="table" title="Sem linhas" description="Nenhum registro encontrado." />;
  }

  return (
    <DataTable columns={`repeat(${data.columns.length}, minmax(120px, 1fr))`} responsiveMinWidth="420px">
      <DataTableHeader>
        {data.columns.map((column) => (
          <DataTableCell key={column.key}>{column.label}</DataTableCell>
        ))}
      </DataTableHeader>
      <DataTableBody>
        {data.rows.map((row, index) => (
          <DataTableRow key={index}>
            {data.columns.map((column) => (
              <DataTableCell key={column.key}>{row[column.key] ?? "-"}</DataTableCell>
            ))}
          </DataTableRow>
        ))}
      </DataTableBody>
    </DataTable>
  );
}
