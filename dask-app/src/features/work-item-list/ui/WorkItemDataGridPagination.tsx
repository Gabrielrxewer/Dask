import { AppIcon, Button, AppSelect } from "@/shared/ui";

interface WorkItemDataGridPaginationProps {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  pageCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export function WorkItemDataGridPagination({
  pageIndex,
  pageSize,
  totalCount,
  pageCount,
  canPreviousPage,
  canNextPage,
  onPageChange,
  onPageSizeChange
}: WorkItemDataGridPaginationProps) {
  return (
    <footer className="work-item-data-grid__pagination">
      <span className="work-item-data-grid__pagination-info">
        Pagina {pageIndex + 1} de {Math.max(pageCount, 1)} - {totalCount} itens
      </span>
      <div className="work-item-data-grid__pagination-controls">
        <AppSelect
          className="work-item-data-grid__page-size"
          value={String(pageSize)}
          items={PAGE_SIZE_OPTIONS.map((option) => ({ value: String(option), label: `${option} / pagina` }))}
          onValueChange={(value) => onPageSizeChange(Number(value))}
          aria-label="Itens por pagina"
        />
        <div className="work-item-data-grid__pagination-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(pageIndex - 1, 0))}
            disabled={!canPreviousPage}
            aria-label="Pagina anterior"
          >
            <AppIcon name="chevron-left" size={15} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={!canNextPage}
            aria-label="Proxima pagina"
          >
            <AppIcon name="chevron-right" size={15} />
          </Button>
        </div>
      </div>
    </footer>
  );
}
