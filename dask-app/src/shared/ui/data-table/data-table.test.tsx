import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  type DataTableColumn,
  DataTableErrorState,
  DataTableEmptyState,
  DataTableHeader,
  DataTableLoadingState,
  DataTablePagination,
  DataTableRow
} from "@/shared/ui/data-table";

interface DemoRow {
  id: string;
  name: string;
  status: string;
  owner: string;
  email: string;
  amount: string;
}

const rows: DemoRow[] = [
  {
    id: "1",
    name: "Dask",
    status: "Ativo",
    owner: "Ana",
    email: "ana@dask.test",
    amount: "R$ 120,00"
  },
  {
    id: "2",
    name: "Pulse",
    status: "Pendente",
    owner: "Bruno",
    email: "bruno@dask.test",
    amount: "R$ 80,00"
  }
];

const columns: Array<DataTableColumn<DemoRow>> = [
  { id: "name", header: "Nome", width: "1fr", render: (row) => row.name },
  { id: "status", header: "Status", width: "120px", render: (row) => row.status },
  { id: "owner", header: "Responsavel", width: "140px", render: (row) => row.owner }
];

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

  it("renderiza linhas configuradas com paginacao padrao e sem selecao ou acoes", () => {
    const html = renderToStaticMarkup(
      <DataTable<DemoRow>
        columns={columns.slice(0, 2)}
        data={[rows[0]]}
        getRowId={(row) => row.id}
      />
    );

    expect(html).toContain("Dask");
    expect(html).toContain("Ativo");
    expect(html).toContain("grid-template-columns:1fr 120px");
    expect(html).toContain("Pagina 1 de 1 - 1 itens");
  });

  it("mantem estados e paginacao como componentes compartilhados", () => {
    const html = renderToStaticMarkup(
      <>
        <DataTable columns="1fr">
          <DataTableBody>
            <DataTableEmptyState title="Nada encontrado" description="Tente outro filtro." />
          </DataTableBody>
        </DataTable>
        <DataTablePagination
          pageIndex={0}
          pageSize={25}
          totalCount={30}
          pageCount={2}
          canPreviousPage={false}
          canNextPage
          onPageChange={() => undefined}
          onPageSizeChange={() => undefined}
        />
      </>
    );

    expect(html).toContain("Nada encontrado");
    expect(html).toContain("Pagina 1 de 2 - 30 itens");
    expect(html).toContain("shared-data-table__pagination");
  });

  it("suporta selecao por checkbox via slots de selecao", () => {
    const html = renderToStaticMarkup(
      <DataTable<DemoRow>
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        selection={{
          selectedRowIds: { "1": true },
          renderHeader: () => <input type="checkbox" aria-label="Selecionar pagina" readOnly />,
          renderCell: (_row, _index, rowId) => (
            <input type="checkbox" aria-label={`Selecionar ${rowId}`} checked={rowId === "1"} readOnly />
          )
        }}
      />
    );

    expect(html).toContain('aria-label="Selecionar pagina"');
    expect(html).toContain('aria-label="Selecionar 1"');
    expect(html).toContain('data-selected="true"');
    expect(html).toContain("grid-template-columns:44px 1fr 120px 140px");
  });

  it("suporta acoes por linha sem acoplar ao modulo List", () => {
    const html = renderToStaticMarkup(
      <DataTable<DemoRow>
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        rowActions={{
          header: "Acoes",
          width: "96px",
          render: (row) => <button type="button">Abrir {row.name}</button>
        }}
      />
    );

    expect(html).toContain("Acoes");
    expect(html).toContain("Abrir Dask");
    expect(html).toContain("grid-template-columns:1fr 120px 140px 96px");
  });

  it("aceita paginacao explicita e usa paginacao padrao quando nao informada", () => {
    const withPagination = renderToStaticMarkup(
      <DataTable<DemoRow>
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        pagination={{
          pageIndex: 1,
          pageSize: 50,
          totalCount: 120,
          pageCount: 3,
          canPreviousPage: true,
          canNextPage: true,
          onPageChange: () => undefined,
          onPageSizeChange: () => undefined
        }}
      />
    );
    const withoutPagination = renderToStaticMarkup(<DataTable<DemoRow> columns={columns} data={rows} getRowId={(row) => row.id} />);

    expect(withPagination).toContain("Pagina 2 de 3 - 120 itens");
    expect(withPagination).toContain("shared-data-table-container");
    expect(withoutPagination).toContain("Pagina 1 de 1 - 2 itens");
    expect(withoutPagination).toContain("shared-data-table__pagination");
  });

  it("renderiza estado vazio, loading e erro na linha visual da tabela", () => {
    const empty = renderToStaticMarkup(
      <DataTable<DemoRow> columns={columns} data={[]} getRowId={(row) => row.id} emptyState="Sem registros" />
    );
    const loading = renderToStaticMarkup(
      <DataTable<DemoRow> columns={columns} data={[]} getRowId={(row) => row.id} loading loadingState="Carregando registros..." />
    );
    const error = renderToStaticMarkup(
      <DataTable<DemoRow> columns={columns} data={[]} getRowId={(row) => row.id} error={new Error("Falha controlada")} />
    );

    expect(empty).toContain("Sem registros");
    expect(empty).toContain("shared-data-table__row--empty");
    expect(loading).toContain("Carregando registros...");
    expect(loading).toContain("shared-loading-state");
    expect(error).toContain("Falha controlada");
    expect(error).toContain("shared-empty-state--error");
  });

  it("suporta muitas colunas e scroll horizontal sem fork visual", () => {
    const wideColumns: Array<DataTableColumn<DemoRow>> = [
      ...columns,
      { id: "email", header: "E-mail", width: "260px", render: (row) => row.email },
      { id: "amount", header: "Valor", width: "160px", render: (row) => row.amount },
      { id: "link", header: "Link", width: "180px", render: (row) => <a href={`mailto:${row.email}`}>{row.email}</a> },
      { id: "button", header: "Botao", width: "120px", render: (row) => <button type="button">{row.status}</button> }
    ];

    const html = renderToStaticMarkup(
      <DataTable<DemoRow>
        columns={wideColumns}
        data={rows}
        getRowId={(row) => row.id}
        responsiveMinWidth="1280px"
        responsiveMinWidthMobile="960px"
      />
    );

    expect(html).toContain("--table-min-width:1280px");
    expect(html).toContain("--table-min-width-mobile:960px");
    expect(html).toContain("mailto:ana@dask.test");
    expect(html).toContain("grid-template-columns:1fr 120px 140px 260px 160px 180px 120px");
  });

  it("suporta colunas configuraveis por visible e columnVisibility", () => {
    const html = renderToStaticMarkup(
      <DataTable<DemoRow>
        columns={[
          ...columns,
          { id: "hiddenByColumn", header: "Oculta coluna", width: "100px", visible: false, render: () => "nao aparece" },
          { id: "hiddenByMap", header: "Oculta mapa", width: "100px", render: () => "tambem nao aparece" }
        ]}
        columnVisibility={{ hiddenByMap: false }}
        data={rows}
        getRowId={(row) => row.id}
      />
    );

    expect(html).not.toContain("nao aparece");
    expect(html).not.toContain("tambem nao aparece");
    expect(html).toContain("grid-template-columns:1fr 120px 140px");
  });

  it("permite footer ou paginacao fixa pelo contrato de classes quando aplicavel", () => {
    const html = renderToStaticMarkup(
      <DataTable<DemoRow>
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        containerClassName="demo-table-shell"
        footer={<span>Resumo fixavel</span>}
        pagination={{
          pageIndex: 0,
          pageSize: 25,
          totalCount: 2,
          pageCount: 1,
          canPreviousPage: false,
          canNextPage: false,
          className: "demo-table-footer--fixed",
          onPageChange: () => undefined
        }}
      />
    );

    expect(html).toContain("demo-table-shell");
    expect(html).toContain("demo-table-footer--fixed");
    expect(html).toContain("shared-data-table__actions-slot");
    expect(html).toContain("Resumo fixavel");
  });

  it("suporta celulas customizadas com badge, avatar, link e botao", () => {
    const html = renderToStaticMarkup(
      <DataTable<DemoRow>
        columns={[
          {
            id: "identity",
            header: "Contato",
            width: "1fr",
            render: (row) => (
              <span className="demo-avatar-cell">
                <span className="demo-avatar">{row.owner.slice(0, 1)}</span>
                <a href={`mailto:${row.email}`}>{row.name}</a>
              </span>
            )
          },
          {
            id: "status",
            header: "Status",
            width: "140px",
            render: (row) => <span className="demo-badge">{row.status}</span>
          },
          {
            id: "action",
            header: "Acao",
            width: "120px",
            render: (row) => <button type="button">Cobrar {row.amount}</button>
          }
        ]}
        data={[rows[0]]}
        getRowId={(row) => row.id}
      />
    );

    expect(html).toContain("demo-avatar");
    expect(html).toContain("demo-badge");
    expect(html).toContain("mailto:ana@dask.test");
    expect(html).toContain("Cobrar R$ 120,00");
  });

  it("expoe componentes diretos de loading e erro para composicao manual", () => {
    const html = renderToStaticMarkup(
      <DataTable columns="1fr">
        <DataTableBody>
          <DataTableLoadingState text="Carregando composicao..." />
          <DataTableErrorState title="Erro manual" description="Falha exibida pelo consumidor." />
        </DataTableBody>
      </DataTable>
    );

    expect(html).toContain("Carregando composicao...");
    expect(html).toContain("Erro manual");
    expect(html).toContain("Falha exibida pelo consumidor.");
  });
});
