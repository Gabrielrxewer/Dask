import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResourceSection } from "@/shared/ui/resource-section";

describe("ResourceSection", () => {
  it("renderiza titulo, subtitulo, actions e conteudo", () => {
    const html = renderToStaticMarkup(
      <ResourceSection
        title="Membros"
        subtitle="Gerencie acessos"
        actions={<button type="button">Novo</button>}
        className="demo-section"
        contentClassName="demo-content"
      >
        <div>Lista</div>
      </ResourceSection>
    );

    expect(html).toContain("shared-resource-section");
    expect(html).toContain("shared-section");
    expect(html).toContain("demo-section");
    expect(html).toContain("demo-content");
    expect(html).toContain("Membros");
    expect(html).toContain("Gerencie acessos");
    expect(html).toContain("Novo");
    expect(html).toContain("Lista");
  });

  it("renderiza empty state padrao quando empty e true", () => {
    const html = renderToStaticMarkup(
      <ResourceSection empty emptyTitle="Nada aqui" emptyDescription="Crie o primeiro item.">
        <div>Conteudo oculto</div>
      </ResourceSection>
    );

    expect(html).toContain("shared-resource-section__empty");
    expect(html).toContain("Nada aqui");
    expect(html).toContain("Crie o primeiro item.");
    expect(html).not.toContain("Conteudo oculto");
  });

  it("permite empty state customizado e variante plain", () => {
    const html = renderToStaticMarkup(
      <ResourceSection variant="plain" empty={<p className="custom-empty">Vazio</p>}>
        <div>Conteudo oculto</div>
      </ResourceSection>
    );

    expect(html).toContain("shared-resource-section");
    expect(html).not.toContain("shared-section");
    expect(html).toContain("custom-empty");
    expect(html).not.toContain("Conteudo oculto");
  });
});
