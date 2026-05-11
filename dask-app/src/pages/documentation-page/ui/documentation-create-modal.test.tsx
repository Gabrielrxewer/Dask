import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentationCreateModal } from "./documentation-create-modal";

const dialogMock = vi.hoisted(() => ({
  actions: [] as Array<{ close: () => void }>
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

describe("DocumentationCreateModal", () => {
  afterEach(() => {
    dialogMock.actions = [];
    vi.restoreAllMocks();
  });

  it("renderiza opcoes da modal e fecha pelo contrato onOpenChange", () => {
    const handleClose = vi.fn();

    const html = renderToStaticMarkup(
      <DocumentationCreateModal onClose={handleClose} onCreate={() => undefined} />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain("Novo documento");
    expect(html).toContain("Escolha o tipo de documento que deseja criar.");
    expect(html).toContain("Wiki");
    expect(html).toContain("Proposta");
    expect(html).toContain("Contrato");

    dialogMock.actions.at(-1)?.close();

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
