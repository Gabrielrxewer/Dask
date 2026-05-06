import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/shared/ui/empty-state";

describe("EmptyState", () => {
  it("renderiza mensagem vazia com className e atributos nativos", () => {
    const html = renderToStaticMarkup(
      <EmptyState className="demo-empty" role="status" data-testid="empty">
        Nenhum registro encontrado.
      </EmptyState>
    );

    expect(html).toContain("shared-empty-state");
    expect(html).toContain("demo-empty");
    expect(html).toContain('role="status"');
    expect(html).toContain('data-testid="empty"');
    expect(html).toContain("Nenhum registro encontrado.");
  });

  it("renderiza estado estruturado com titulo, descricao, icone, acao e tamanho", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        title="Nenhum documento"
        description="Os documentos aparecerao aqui."
        icon={<span>doc</span>}
        action={<button type="button">Criar</button>}
        size="compact"
      />
    );

    expect(html).toContain("shared-empty-state--structured");
    expect(html).toContain("shared-empty-state--compact");
    expect(html).toContain("shared-empty-state__icon");
    expect(html).toContain("Nenhum documento");
    expect(html).toContain("Os documentos aparecerao aqui.");
    expect(html).toContain("Criar");
  });
});
