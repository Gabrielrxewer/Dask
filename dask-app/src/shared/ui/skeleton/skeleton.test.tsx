import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SkeletonBlock, SkeletonColumns, SkeletonLayout } from "@/shared/ui/skeleton";

describe("Skeleton", () => {
  it("renderiza blocos com dimensoes e aria-hidden por padrao", () => {
    const html = renderToStaticMarkup(
      <SkeletonBlock width={120} height="48%" flex="1 1 auto" className="demo-block" />
    );

    expect(html).toContain("shared-skeleton-block");
    expect(html).toContain("demo-block");
    expect(html).toContain("width:120px");
    expect(html).toContain("height:48%");
    expect(html).toContain("flex:1 1 auto");
    expect(html).toContain('aria-hidden="true"');
  });

  it("renderiza layout por quantidade e direcao", () => {
    const html = renderToStaticMarkup(
      <SkeletonLayout count={2} direction="column" gap={12} blockProps={{ minHeight: 32 }} />
    );

    expect(html).toContain("shared-skeleton-layout--column");
    expect(html).toContain("gap:12px");
    expect(html.match(/shared-skeleton-block/g)?.length).toBe(2);
    expect(html).toContain("min-height:32px");
  });

  it("renderiza colunas com largura configuravel", () => {
    const html = renderToStaticMarkup(<SkeletonColumns count={4} columnWidth={265} minHeight={360} />);

    expect(html).toContain("shared-skeleton-layout--row");
    expect(html.match(/shared-skeleton-block/g)?.length).toBe(4);
    expect(html).toContain("flex:0 0 265px");
    expect(html).toContain("min-height:360px");
  });
});
