import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoadingState, PageLoadingState } from "@/shared/ui/loading-state";

describe("LoadingState", () => {
  it("renderiza estado generico acessivel", () => {
    const html = renderToStaticMarkup(
      <LoadingState animation="default" text="Carregando dados" className="demo-loading" />
    );

    expect(html).toContain("shared-loading-state--default");
    expect(html).toContain("shared-loading-state__visual--list");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-hidden="false"');
    expect(html).toContain("demo-loading");
    expect(html).toContain("Carregando dados");
  });

  it("preserva o frame e oculta semanticamente quando invisivel", () => {
    const html = renderToStaticMarkup(
      <LoadingState animation="billing" variant="frame" visible={false} data-testid="loading" />
    );

    expect(html).toContain("shared-loading-state--frame");
    expect(html).toContain("shared-loading-state--billing");
    expect(html).toContain("shared-loading-state--out");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-testid="loading"');
  });

  it("centraliza loading inicial de pagina sem usar overlay de frame", () => {
    const html = renderToStaticMarkup(
      <PageLoadingState animation="automation" text="Carregando modulo" contentClassName="route-loading" />
    );

    expect(html).toContain("shared-page-loading-state");
    expect(html).toContain("shared-loading-state--inline");
    expect(html).not.toContain("shared-loading-state--frame");
    expect(html).toContain("route-loading");
    expect(html).toContain("Carregando modulo");
  });
});
