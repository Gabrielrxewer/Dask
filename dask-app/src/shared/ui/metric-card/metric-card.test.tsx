import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MetricCard } from "@/shared/ui/metric-card";

describe("MetricCard", () => {
  it("renderiza label, value, subtitle, icon, tone e trend", () => {
    const html = renderToStaticMarkup(
      <MetricCard
        label="Pipeline total"
        value="R$ 120 mil"
        subtitle="12 oportunidades ativas"
        helpText="Valor total em negociacao."
        icon={<span data-testid="metric-icon">I</span>}
        tone="blue"
        trend={{ value: "+8%", tone: "positive", label: "Crescimento" }}
        className="custom-metric"
      />
    );

    expect(html).toContain("shared-metric-card--blue");
    expect(html).toContain("shared-metric-card--with-icon");
    expect(html).toContain("custom-metric");
    expect(html).toContain("Pipeline total");
    expect(html).toContain("R$ 120 mil");
    expect(html).toContain("12 oportunidades ativas");
    expect(html).toContain("+8%");
    expect(html).toContain("shared-metric-card__trend--positive");
    expect(html).toContain("Mais informacoes sobre Pipeline total");
  });

  it("mantem compatibilidade com description como help text", () => {
    const html = renderToStaticMarkup(
      <MetricCard label="Cards antigos" value={42} description="Descricao legada" />
    );

    expect(html).toContain("Cards antigos");
    expect(html).toContain("42");
    expect(html).toContain("Mais informacoes sobre Cards antigos");
  });
});
