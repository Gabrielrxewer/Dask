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
});
