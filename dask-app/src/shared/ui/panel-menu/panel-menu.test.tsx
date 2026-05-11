import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PanelMenuItem } from "./panel-menu";

describe("PanelMenuItem", () => {
  it("does not render nested buttons when an actionable item has row actions", () => {
    const html = renderToStaticMarkup(
      <PanelMenuItem
        label="Agente"
        onClick={() => undefined}
        actions={<button type="button">Arquivar</button>}
      />
    );

    expect(html).toContain('role="button"');
    expect(html).not.toMatch(/<button[^>]*class="panel-menu-item[\s\S]*<button/);
  });
});
