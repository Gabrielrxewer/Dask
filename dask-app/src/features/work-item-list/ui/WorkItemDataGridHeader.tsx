import { flexRender, type Table } from "@tanstack/react-table";
import type { Task } from "@/entities/task";
import { DataTableCell, DataTableHeader, AppIcon } from "@/shared/ui";

interface WorkItemDataGridHeaderProps {
  table: Table<Task>;
}

export function WorkItemDataGridHeader({ table }: WorkItemDataGridHeaderProps) {
  return (
    <>
      {table.getHeaderGroups().map((headerGroup) => (
        <DataTableHeader key={headerGroup.id} className="work-item-data-grid__header">
          {headerGroup.headers.map((header) => {
            const sorted = header.column.getIsSorted();

            const content = flexRender(header.column.columnDef.header, header.getContext());

            return (
              <DataTableCell key={header.id} className="work-item-data-grid__header-cell">
                {header.isPlaceholder ? null : header.column.getCanSort() ? (
                  <button
                    type="button"
                    className="work-item-data-grid__header-button"
                    onClick={header.column.getToggleSortingHandler()}
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                  >
                    <span>{content}</span>
                    {sorted ? (
                      <AppIcon
                        className={sorted === "desc" ? "work-item-data-grid__sort-icon is-desc" : "work-item-data-grid__sort-icon"}
                        name="arrow-up"
                        size={12}
                      />
                    ) : null}
                  </button>
                ) : (
                  <span className="work-item-data-grid__header-static">{content}</span>
                )}
              </DataTableCell>
            );
          })}
        </DataTableHeader>
      ))}
    </>
  );
}
