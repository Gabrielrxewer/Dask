import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDialog } from "@/shared/ui/dialog";

const dialogMock = vi.hoisted(() => ({
  actions: [] as Array<{ open: () => void; close: () => void }>
}));

vi.mock("@radix-ui/react-dialog", async () => {
  const React = await import("react");

  type DialogContextValue = {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  };

  const DialogContext = React.createContext<DialogContextValue>({ open: false });

  return {
    Root: ({
      children,
      open,
      defaultOpen,
      onOpenChange
    }: {
      children: React.ReactNode;
      open?: boolean;
      defaultOpen?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => {
      dialogMock.actions.push({
        open: () => onOpenChange?.(true),
        close: () => onOpenChange?.(false)
      });

      return (
        <DialogContext.Provider value={{ open: open ?? defaultOpen ?? false, onOpenChange }}>
          {children}
        </DialogContext.Provider>
      );
    },
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Overlay: (props: React.HTMLAttributes<HTMLDivElement>) => {
      const context = React.useContext(DialogContext);
      return context.open ? <div {...props} /> : null;
    },
    Content: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
      const context = React.useContext(DialogContext);
      return context.open ? <div role="dialog" {...props}>{children}</div> : null;
    },
    Title: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
    Description: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
    Close: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props}>{children}</button>
    ),
    Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>
  };
});

describe("AppDialog", () => {
  afterEach(() => {
    dialogMock.actions = [];
    vi.restoreAllMocks();
  });

  it("renderiza overlay e conteudo quando controlado com open=true", () => {
    const html = renderToStaticMarkup(
      <AppDialog open title="Modal de teste" description="Descricao curta">
        Conteudo visivel
      </AppDialog>
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain("shared-modal-overlay");
    expect(html).toContain("app-dialog__content shared-dialog-shell");
    expect(html).toContain("Modal de teste");
    expect(html).toContain("Descricao curta");
    expect(html).toContain("Conteudo visivel");
  });

  it("mantem contrato controlado de abrir e fechar via onOpenChange", () => {
    let open = false;
    const handleOpenChange = vi.fn((nextOpen: boolean) => {
      open = nextOpen;
    });

    const renderDialog = () =>
      renderToStaticMarkup(
        <AppDialog
          open={open}
          onOpenChange={handleOpenChange}
          trigger={<button type="button">Abrir modal</button>}
          title="Fluxo controlado"
        >
          Conteudo controlado
        </AppDialog>
      );

    let html = renderDialog();

    expect(html).toContain("Abrir modal");
    expect(html).not.toContain("Conteudo controlado");

    dialogMock.actions.at(-1)?.open();

    expect(handleOpenChange).toHaveBeenLastCalledWith(true);
    expect(open).toBe(true);

    html = renderDialog();

    expect(html).toContain("Fluxo controlado");
    expect(html).toContain("Conteudo controlado");

    dialogMock.actions.at(-1)?.close();

    expect(handleOpenChange).toHaveBeenLastCalledWith(false);
    expect(open).toBe(false);
    expect(renderDialog()).not.toContain("Conteudo controlado");
  });
});
