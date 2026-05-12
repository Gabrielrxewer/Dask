import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResourceTable, type ResourceTableColumn } from "@/shared/ui/resource-table";

interface InvoiceRow {
  id: string;
  reference: string;
  amount: number;
}

const columns: Array<ResourceTableColumn<InvoiceRow>> = [
  { id: "reference", header: "Referencia", accessor: "reference", width: "1fr" },
  {
    id: "amount",
    header: "Valor",
    width: "0.6fr",
    render: (row) => `R$ ${row.amount.toFixed(2)}`
  }
];

describe("ResourceTable", () => {
  it("renderiza colunas declarativas, celulas customizadas e acoes por linha", () => {
    const html = renderToStaticMarkup(
      <ResourceTable
        data={[{ id: "invoice-1", reference: "NF-001", amount: 49.9 }]}
        columns={columns}
        rowKey="id"
        actions={{
          header: "Acoes",
          width: "0.4fr",
          render: (row) => <button type="button">Abrir {row.reference}</button>
        }}
      />
    );

    expect(html).toContain("Referencia");
    expect(html).toContain("NF-001");
    expect(html).toContain("R$ 49.90");
    expect(html).toContain("Abrir NF-001");
    expect(html).toContain("grid-template-columns:1fr 0.6fr 0.4fr");
  });

  it("renderiza estado vazio dentro da tabela", () => {
    const html = renderToStaticMarkup(
      <ResourceTable data={[]} columns={columns} rowKey="id" emptyState="Nenhuma nota encontrada." />
    );

    expect(html).toContain("Nenhuma nota encontrada.");
    expect(html).toContain("shared-data-table__row--empty");
    expect(html).toContain("shared-data-table__cell--full");
    expect(html).toContain("shared-empty-state--table");
  });

  it("prioriza estado de carregamento opcional", () => {
    const html = renderToStaticMarkup(
      <ResourceTable
        data={[{ id: "invoice-1", reference: "NF-001", amount: 49.9 }]}
        columns={columns}
        rowKey="id"
        loading
        loadingState="Carregando notas..."
      />
    );

    expect(html).toContain("Carregando notas...");
    expect(html).not.toContain("NF-001");
  });

  it("aplica classe declarativa na linha", () => {
    const html = renderToStaticMarkup(
      <ResourceTable
        data={[{ id: "invoice-1", reference: "NF-001", amount: 49.9 }]}
        columns={columns}
        rowKey="id"
        rowClassName={(row) => (row.amount > 0 ? "invoice-row" : undefined)}
      />
    );

    expect(html).toContain("shared-data-table__row invoice-row");
  });

  it("renderiza ordenacao manual e paginacao server-side", () => {
    const html = renderToStaticMarkup(
      <ResourceTable
        data={[{ id: "invoice-1", reference: "NF-001", amount: 49.9 }]}
        columns={[{ ...columns[0], sortable: true, sortKey: "reference" }, columns[1]]}
        rowKey="id"
        sortBy="reference"
        sortDirection="desc"
        onSortChange={() => undefined}
        pagination={{
          page: 2,
          pageSize: 25,
          pageSizeOptions: [10, 25, 50],
          hasPrevious: true,
          hasNext: true,
          onPrevious: () => undefined,
          onNext: () => undefined,
          onPageSizeChange: () => undefined
        }}
      />
    );

    expect(html).toContain("aria-sort=\"descending\"");
    expect(html).toContain("Pagina 2");
    expect(html).toContain("25 / pagina");
    expect(html).toContain("shared-resource-table__pagination");
  });

  it("renderiza erro e cards mobile quando configurados", () => {
    const html = renderToStaticMarkup(
      <ResourceTable
        data={[{ id: "invoice-1", reference: "NF-001", amount: 49.9 }]}
        columns={columns}
        rowKey="id"
        mobileCard={{ render: (row) => <strong>{row.reference}</strong> }}
        error="Falha ao carregar notas."
      />
    );

    expect(html).toContain("Falha ao carregar notas.");
    expect(html).toContain("shared-empty-state--error");
    expect(html).toContain("shared-resource-table__mobile-state");
  });
});
