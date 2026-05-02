import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/shared/ui/status-badge";

describe("StatusBadge", () => {
  it("renderiza tons, tamanho e className", () => {
    const html = renderToStaticMarkup(
      <StatusBadge tone="muted" size="sm" className="demo-badge">Arquivado</StatusBadge>
    );

    expect(html).toContain("shared-status-badge--muted");
    expect(html).toContain("shared-status-badge--sm");
    expect(html).toContain("shared-status-badge--pill");
    expect(html).toContain("demo-badge");
    expect(html).toContain("Arquivado");
  });

  it("renderiza dot e count", () => {
    const html = renderToStaticMarkup(<StatusBadge tone="danger" count={3} dot />);

    expect(html).toContain("shared-status-badge--danger");
    expect(html).toContain("shared-status-badge--count");
    expect(html).toContain("shared-status-badge--with-dot");
    expect(html).toContain("shared-status-badge__dot");
    expect(html).toContain(">3</span>");
  });

  it("permite badge sem formato pill", () => {
    const html = renderToStaticMarkup(<StatusBadge pill={false}>Aberto</StatusBadge>);

    expect(html).toContain("shared-status-badge");
    expect(html).not.toContain("shared-status-badge--pill");
  });
});
