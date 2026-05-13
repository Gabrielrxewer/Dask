import { describe, expect, it } from "vitest";
import { parseMarkdownToBlocks, serializeMarkdownBlocks } from "./editable-markdown-preview";

describe("editable markdown preview", () => {
  it("round-trips existing markdown structures without changing persisted content", () => {
    const markdown = [
      "# Titulo",
      "",
      "## Secao",
      "Texto normal",
      "- Item",
      "1. Passo",
      "- [ ] Tarefa",
      "> Citacao",
      "```ts",
      "const ok = true;",
      "```",
      "| Coluna A | Coluna B |",
      "| --- | --- |",
      "| Valor 1 | Valor 2 |",
      "---"
    ].join("\n");

    expect(serializeMarkdownBlocks(parseMarkdownToBlocks(markdown))).toBe(markdown);
  });
});
