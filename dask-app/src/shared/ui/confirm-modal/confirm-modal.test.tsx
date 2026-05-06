import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConfirmModalFrame } from "@/shared/ui/confirm-modal";

describe("ConfirmModalFrame", () => {
  it("renderiza confirmacao com titulo, descricao, icone e acoes", () => {
    const html = renderToStaticMarkup(
      <ConfirmModalFrame
        titleId="confirm-title"
        eyebrow="Excluir item"
        title="Remover item?"
        description="Essa acao preserva o historico anterior."
        icon={<span>!</span>}
        confirmLabel="Excluir item"
        onClose={() => undefined}
        onConfirm={() => undefined}
        tone="danger"
      />
    );

    expect(html).toContain("shared-confirm-modal__frame");
    expect(html).toContain("shared-confirm-modal__frame--danger");
    expect(html).toContain("shared-confirm-modal__icon");
    expect(html).toContain('id="confirm-title"');
    expect(html).toContain("Excluir item");
    expect(html).toContain("Remover item?");
    expect(html).toContain("Essa acao preserva o historico anterior.");
    expect(html).toContain("Cancelar");
  });
});
