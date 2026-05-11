import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentMarkdownRenderer } from "@/modules/documentation/rendering/DocumentMarkdownRenderer";

describe("DocumentMarkdownRenderer", () => {
  it("renders shared GFM markdown without enabling dangerous raw HTML", () => {
    const html = renderToStaticMarkup(
      <DocumentMarkdownRenderer
        markdown={[
          "# Proposta",
          "",
          "| Item | Valor |",
          "| --- | ---: |",
          "| Servico | 100 |",
          "",
          "<script>alert(1)</script>",
          "",
          "[seguro](https://example.com)",
          "[perigoso](javascript:alert(1))"
        ].join("\n")}
      />
    );

    expect(html).toContain("<table>");
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain("<script");
    expect(html).not.toContain('href="javascript:');
  });

  it("allows only safe markdown urls and raster data images", () => {
    const html = renderToStaticMarkup(
      <DocumentMarkdownRenderer
        markdown={[
          "![png](data:image/png;base64,iVBORw0KGgo=)",
          "![svg](data:image/svg+xml;base64,PHN2Zy8+)",
          "![html](data:text/html;base64,PGgxPkJvb208L2gxPg==)",
          "[relative](/docs/guide)"
        ].join("\n\n")}
      />
    );

    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(html).toContain('href="/docs/guide"');
    expect(html).not.toContain("data:image/svg");
    expect(html).not.toContain("data:text/html");
  });
});
