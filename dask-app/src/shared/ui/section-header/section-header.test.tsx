import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectionHeader } from "@/shared/ui/section-header";

describe("SectionHeader", () => {
  it("renderiza titulo, descricao, eyebrow, badge e acoes", () => {
    const html = renderToStaticMarkup(
      <SectionHeader
        title="Historico"
        description="Ultimas cobrancas"
        eyebrow="Billing"
        badge={<span>3 itens</span>}
        secondaryAction={<button type="button">Exportar</button>}
        action={<button type="button">Criar</button>}
        className="custom-section-header"
      />
    );

    expect(html).toContain("shared-section-header");
    expect(html).toContain("custom-section-header");
    expect(html).toContain("Billing");
    expect(html).toContain("Historico");
    expect(html).toContain("Ultimas cobrancas");
    expect(html).toContain("3 itens");
    expect(html).toContain("Exportar");
    expect(html).toContain("Criar");
  });
});
