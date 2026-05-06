import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ModuleTabs, type ModuleTabsItem } from "@/shared/ui/module-tabs";

type DemoTab = "overview" | "settings";

const items: Array<ModuleTabsItem<DemoTab>> = [
  { id: "overview", label: "Visao geral", badge: 2 },
  { id: "settings", label: "Settings", disabled: true }
];

describe("ModuleTabs", () => {
  it("renderiza tabs de estado local com variante e badge", () => {
    const html = renderToStaticMarkup(
      <ModuleTabs
        value="overview"
        items={items}
        onChange={() => undefined}
        ariaLabel="Modulo demo"
        className="demo-tabs"
        variant="underline"
      />
    );

    expect(html).toContain("module-tabs");
    expect(html).toContain("module-tabs--underline");
    expect(html).toContain('aria-label="Modulo demo"');
    expect(html).toContain("module-tabs__item--active");
    expect(html).toContain("module-tabs__badge");
    expect(html).toContain("shared-tabs__item--disabled");
  });

  it("renderiza tabs por rota usando NavLink", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/w/demo/settings"]}>
        <ModuleTabs
          items={[{ id: "settings", label: "Settings", to: "/w/demo/settings", end: true }]}
          ariaLabel="Rotas"
        />
      </MemoryRouter>
    );

    expect(html).toContain('href="/w/demo/settings"');
    expect(html).toContain("module-tabs__item--active");
  });
});
