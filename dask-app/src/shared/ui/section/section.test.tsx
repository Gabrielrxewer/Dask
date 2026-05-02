import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Section } from "@/shared/ui/section";

describe("Section", () => {
  it("aceita titulo ReactNode, classes de conteudo e atributos nativos", () => {
    const html = renderToStaticMarkup(
      <Section
        title={<span>Resumo</span>}
        subtitle={<span>Ultimos dados</span>}
        actions={<button type="button">Atualizar</button>}
        className="demo-section"
        contentClassName="demo-content"
        aria-label="Secao demo"
      >
        Conteudo
      </Section>
    );

    expect(html).toContain("shared-section");
    expect(html).toContain("demo-section");
    expect(html).toContain("demo-content");
    expect(html).toContain('aria-label="Secao demo"');
    expect(html).toContain("Atualizar");
    expect(html).toContain("Conteudo");
  });
});
