import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DrawerShellFrame } from "@/shared/ui/drawer-shell";

describe("DrawerShellFrame", () => {
  it("renderiza header, nav, body, erro e footer com classes customizadas", () => {
    const html = renderToStaticMarkup(
      <DrawerShellFrame
        title="Editar acesso"
        titleId="drawer-title"
        subtitle="Permissoes do membro"
        leading={<span className="demo-avatar">GA</span>}
        nav={<button type="button">Role</button>}
        error="Falha ao salvar"
        footer={<button type="button">Salvar</button>}
        onClose={() => undefined}
        className="demo-drawer"
        headerClassName="demo-header"
        titleWrapperClassName="demo-title"
        navClassName="demo-nav"
        bodyClassName="demo-body"
        errorClassName="demo-error"
        footerClassName="demo-footer"
        closeButtonClassName="demo-close"
        closeButtonContent="x"
      >
        Conteudo
      </DrawerShellFrame>
    );

    expect(html).toContain("shared-drawer-shell__frame");
    expect(html).toContain("demo-drawer");
    expect(html).toContain("demo-header");
    expect(html).toContain("demo-title");
    expect(html).toContain("demo-nav");
    expect(html).toContain("demo-body");
    expect(html).toContain("demo-error");
    expect(html).toContain("demo-footer");
    expect(html).toContain("demo-close");
    expect(html).toContain('id="drawer-title"');
    expect(html).toContain("Editar acesso");
    expect(html).toContain("Falha ao salvar");
    expect(html).toContain("Salvar");
  });
});
