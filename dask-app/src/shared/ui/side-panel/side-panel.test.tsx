import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SidePanel } from "@/shared/ui/side-panel";

describe("SidePanel", () => {
  it("renderiza o frame compartilhado com variante, descricao e corpo", () => {
    const html = renderToStaticMarkup(
      <SidePanel
        title="Configuracao"
        titleId="side-panel-title"
        description="Ajustes do item selecionado"
        variant="config"
        onClose={() => undefined}
        className="demo-panel"
        bodyClassName="demo-body"
      >
        Conteudo do painel
      </SidePanel>
    );

    expect(html).toContain("shared-side-panel");
    expect(html).toContain("shared-side-panel--config");
    expect(html).toContain("demo-panel");
    expect(html).toContain("demo-body");
    expect(html).toContain('id="side-panel-title"');
    expect(html).toContain("Ajustes do item selecionado");
    expect(html).toContain("Conteudo do painel");
  });
});
