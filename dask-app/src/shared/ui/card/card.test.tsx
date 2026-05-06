import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Card } from "@/shared/ui/card";

describe("Card", () => {
  it("renderiza variantes opt-in, interatividade e accent", () => {
    const html = renderToStaticMarkup(
      <Card variant="featured" accent="blue" interactive className="custom-card">
        Conteudo
      </Card>
    );

    expect(html).toContain("shared-card");
    expect(html).toContain("shared-card--featured");
    expect(html).toContain("shared-card--interactive");
    expect(html).toContain("shared-card--accent-blue");
    expect(html).toContain("custom-card");
  });

  it("mantem compatibilidade com variant interactive legado", () => {
    const html = renderToStaticMarkup(<Card variant="interactive">Legado</Card>);

    expect(html).toContain("shared-card--default");
    expect(html).toContain("shared-card--interactive");
    expect(html).toContain("Legado");
  });
});
