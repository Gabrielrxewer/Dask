import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NodeConfigForm } from "./NodeConfigForm";
import type { NodeConfigDescriptor } from "./types";

describe("NodeConfigForm", () => {
  it("renders structured key-value fields without raw JSON editing", () => {
    const descriptor: NodeConfigDescriptor = {
      type: "activity",
      label: "Activity",
      fields: [
        {
          name: "payload",
          label: "Dados adicionais",
          type: "key-value-list",
          keyLabel: "Chave",
          valueLabel: "Valor"
        }
      ]
    };

    const html = renderToStaticMarkup(
      <NodeConfigForm
        descriptor={descriptor}
        value={{ payload: { severity: "info" } }}
        onChange={() => undefined}
      />
    );

    expect(html).toContain("Dados adicionais");
    expect(html).toContain("Chave");
    expect(html).toContain("severity");
    expect(html).toContain("info");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("Aplicar JSON");
  });
});
