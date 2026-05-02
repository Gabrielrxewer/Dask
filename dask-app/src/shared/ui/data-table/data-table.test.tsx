import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable, DataTableBody, DataTableCell, DataTableHeader, DataTableRow } from "@/shared/ui/data-table";

describe("DataTable", () => {
  it("aceita atributos nativos nas partes principais", () => {
    const html = renderToStaticMarkup(
      <DataTable columns="1fr 2fr" aria-label="Tabela demo" data-testid="table">
        <DataTableHeader data-testid="header">
          <span>Nome</span>
          <span>Status</span>
        </DataTableHeader>
        <DataTableBody data-testid="body">
          <DataTableRow data-testid="row">
            <DataTableCell data-testid="cell">Dask</DataTableCell>
            <DataTableCell>Ativo</DataTableCell>
          </DataTableRow>
        </DataTableBody>
      </DataTable>
    );

    expect(html).toContain('aria-label="Tabela demo"');
    expect(html).toContain('data-testid="table"');
    expect(html).toContain('data-testid="header"');
    expect(html).toContain('data-testid="body"');
    expect(html).toContain('data-testid="row"');
    expect(html).toContain('data-testid="cell"');
    expect(html).toContain("grid-template-columns:1fr 2fr");
  });
});
