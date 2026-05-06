import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BuilderPageTemplate,
  DashboardPageTemplate,
  DetailPreviewTemplate,
  ResourceListPageTemplate,
  SettingsPageTemplate
} from "@/shared/ui/page-template";

describe("Page templates", () => {
  it("renderiza templates estruturais com slots", () => {
    const dashboard = renderToStaticMarkup(
      <DashboardPageTemplate metrics={<span>metricas</span>} toolbar={<span>toolbar</span>}>
        conteudo
      </DashboardPageTemplate>
    );
    const list = renderToStaticMarkup(
      <ResourceListPageTemplate title="Lista" loading={<span>loading</span>}>
        tabela
      </ResourceListPageTemplate>
    );
    const settings = renderToStaticMarkup(
      <SettingsPageTemplate tabs={<span>tabs</span>} aside={<span>aside</span>}>
        config
      </SettingsPageTemplate>
    );
    const detail = renderToStaticMarkup(
      <DetailPreviewTemplate header={<span>header</span>} preview={<span>preview</span>}>
        detalhe
      </DetailPreviewTemplate>
    );
    const builder = renderToStaticMarkup(
      <BuilderPageTemplate palette={<span>palette</span>} inspector={<span>inspector</span>}>
        canvas
      </BuilderPageTemplate>
    );

    expect(dashboard).toContain("shared-page-template--dashboard");
    expect(list).toContain("shared-page-template--resource-list");
    expect(settings).toContain("shared-page-template--settings");
    expect(detail).toContain("shared-page-template--detail-preview");
    expect(builder).toContain("shared-page-template--builder");
  });
});
