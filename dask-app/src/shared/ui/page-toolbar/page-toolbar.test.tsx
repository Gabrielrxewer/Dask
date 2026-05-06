import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageToolbar } from "@/shared/ui/page-toolbar";

describe("PageToolbar", () => {
  it("renderiza regioes de busca, filtros e acoes", () => {
    const html = renderToStaticMarkup(
      <PageToolbar
        compact
        ariaLabel="Toolbar demo"
        search={<input aria-label="Buscar" />}
        filters={<button type="button">Filtros</button>}
        secondaryActions={<button type="button">Exportar</button>}
        primaryAction={<button type="button">Criar</button>}
      />
    );

    expect(html).toContain("shared-page-toolbar--compact");
    expect(html).toContain('aria-label="Toolbar demo"');
    expect(html).toContain("shared-page-toolbar__search");
    expect(html).toContain("shared-page-toolbar__filters");
    expect(html).toContain("shared-page-toolbar__secondary");
    expect(html).toContain("shared-page-toolbar__primary");
  });
});
