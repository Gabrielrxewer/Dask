import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Tabs, WorkspaceTopNavigation, type TabsItem } from "@/shared/ui/tabs";

type DemoTab = "overview" | "billing" | "locked";

const items: Array<TabsItem<DemoTab>> = [
  { id: "overview", label: "Visao geral" },
  { id: "billing", label: "Cobranca", badge: 3, badgeClassName: "billing-count" },
  { id: "locked", label: "Bloqueado", locked: true }
];

describe("Tabs", () => {
  it("renderiza tabs com valor ativo, badge e estado locked", () => {
    const html = renderToStaticMarkup(
      <Tabs
        value="billing"
        items={items}
        onChange={() => undefined}
        ariaLabel="Navegacao demo"
        className="demo-tabs"
        itemClassName="demo-tab"
        activeItemClassName="is-active"
        lockedItemClassName="is-locked"
      />
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Navegacao demo"');
    expect(html).toContain("shared-tabs__item--active");
    expect(html).toContain("is-active");
    expect(html).toContain("billing-count");
    expect(html).toContain("shared-tabs__item--locked");
    expect(html).toContain("is-locked");
    expect(html).toContain('aria-disabled="true"');
  });

  it("renderiza top navigation com actions a direita", () => {
    const html = renderToStaticMarkup(
      <WorkspaceTopNavigation
        value="overview"
        items={items}
        onChange={() => undefined}
        ariaLabel="Top nav demo"
        className="demo-top-nav"
        tabsClassName="demo-tabs"
        actionsClassName="demo-actions"
        actions={<button type="button">Atualizar</button>}
      />
    );

    expect(html).toContain("shared-top-navigation");
    expect(html).toContain("demo-top-nav");
    expect(html).toContain("demo-actions");
    expect(html).toContain("Atualizar");
  });

  it("renderiza badge customizado sem wrapper extra", () => {
    const html = renderToStaticMarkup(
      <Tabs
        value="overview"
        items={[{ id: "overview", label: "Visao geral", title: "Abrir visao geral", badge: <strong className="custom-badge">2</strong> }]}
        onChange={() => undefined}
        afterItems={<button type="button" className="after-tabs">Mais</button>}
      />
    );

    expect(html).toContain("custom-badge");
    expect(html).toContain('title="Abrir visao geral"');
    expect(html).toContain("after-tabs");
    expect(html).not.toContain("shared-tabs__badge");
  });
});
