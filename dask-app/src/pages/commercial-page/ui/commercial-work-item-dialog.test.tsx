import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskFieldDefinition } from "@/entities/task";
import type { ConnectCatalogItem } from "@/modules/billing";
import type { Customer } from "@/modules/workspace";
import { CommercialWorkItemDialog } from "./commercial-work-item-dialog";
import type { CommercialWorkItemFormState } from "./commercial-page.model";

const mutationMocks = vi.hoisted(() => ({
  customer: { mutateAsync: vi.fn(), isPending: false },
  workItem: { mutateAsync: vi.fn(), isPending: false },
  signal: { mutateAsync: vi.fn(), isPending: false }
}));

vi.mock("@/modules/commercial", () => ({
  useCreateCustomerMutation: () => mutationMocks.customer,
  useCreateCommercialWorkItemMutation: () => mutationMocks.workItem,
  useCreateSignalWorkItemMutation: () => mutationMocks.signal
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
    }) => (
      <DialogContext.Provider value={{ open: open ?? defaultOpen ?? false, onOpenChange }}>
        {children}
      </DialogContext.Provider>
    ),
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

const defaultValues: CommercialWorkItemFormState = {
  customerId: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  companyName: "",
  source: "",
  interest: "",
  estimatedValue: "",
  proposalValidity: "",
  notes: ""
};

const customer: Customer = {
  id: "customer-1",
  workspaceId: "workspace-1",
  name: "Acme Ltda",
  status: "prospect",
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z"
};

const catalogItem: ConnectCatalogItem = {
  id: "catalog-1",
  kind: "SERVICE",
  billingType: "ONE_TIME",
  recurringInterval: null,
  recurringIntervalCount: null,
  name: "Implantacao",
  description: "Escopo de implantacao",
  amount: 150000,
  currency: "brl",
  stripeConnectAccountId: null,
  stripeProductId: null,
  stripePriceId: null,
  isActive: true,
  metadata: null,
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z"
};

const fieldDefinitions: TaskFieldDefinition[] = [
  { id: "field-company", label: "Empresa", slug: "companyName", type: "text" }
];

describe("CommercialWorkItemDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o Dialog padronizado para criacao de WorkItem comercial", () => {
    const html = renderToStaticMarkup(
      <CommercialWorkItemDialog
        open
        mode="workItem"
        workspaceId="workspace-1"
        defaultValues={defaultValues}
        customers={[customer]}
        catalogItems={[catalogItem]}
        catalogItemsById={new Map([[catalogItem.id, catalogItem]])}
        fieldDefinitions={fieldDefinitions}
        commercialTypeId="commercial"
        signalTypeId="signal"
        initialStatusId="new"
        signalInitialStatusId="captured"
        onOpenChange={() => undefined}
      />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain("Novo WorkItem comercial");
    expect(html).toContain("Cliente vinculado");
    expect(html).toContain("Empresa");
    expect(html).toContain("Criar WorkItem");
  });
});
