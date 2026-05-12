import { describe, expect, it, vi } from "vitest";
import type { TaskFieldDefinition } from "@/entities/task";
import type { ConnectCatalogItem } from "@/modules/billing";
import type { CommercialWorkItemFormValues } from "@/modules/commercial/model";
import type { Customer } from "@/modules/workspace";
import { submitCommercialWorkItem } from "./commercial-work-item-dialog.model";

const fieldDefinitions: TaskFieldDefinition[] = [
  { id: "field-customer", definitionId: "def-customer", label: "Cliente", slug: "customerId", type: "text" },
  { id: "field-company", definitionId: "def-company", label: "Empresa", slug: "companyName", type: "text" },
  { id: "field-value", definitionId: "def-value", label: "Valor", slug: "estimatedValue", type: "number" }
];

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
  metadata: {
    paymentTerms: "50/50",
    proposalValidity: "2026-06-30",
    scope: "Implantacao assistida"
  },
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z"
};

const existingCustomer: Customer = {
  id: "customer-existing",
  workspaceId: "workspace-1",
  name: "Acme Ltda",
  email: "comercial@acme.com",
  phone: "11999990000",
  status: "prospect",
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z"
};

const baseForm: CommercialWorkItemFormValues = {
  customerId: "",
  contactName: "Ana Cliente",
  contactEmail: "ana@example.com",
  contactPhone: "11988887777",
  companyName: "Nova Conta",
  source: "Inbound",
  interest: "catalog-1",
  estimatedValue: "",
  proposalValidity: "",
  notes: "Prioridade alta"
};

describe("submitCommercialWorkItem", () => {
  it("creates a Customer before creating the commercial WorkItem when no match exists", async () => {
    const createdCustomer: Customer = {
      ...existingCustomer,
      id: "customer-created",
      name: "Nova Conta",
      email: "ana@example.com",
      phone: "11988887777"
    };
    const createCustomer = vi.fn().mockResolvedValue(createdCustomer);
    const createWorkItem = vi.fn().mockResolvedValue({ id: "work-item-1" });

    const result = await submitCommercialWorkItem(
      baseForm,
      {
        kind: "workItem",
        commercialTypeId: "commercial",
        signalTypeId: "signal",
        initialStatusId: "new",
        signalInitialStatusId: "captured",
        fieldDefinitions,
        catalogItemsById: new Map([[catalogItem.id, catalogItem]])
      },
      {
        customers: [],
        createCustomer,
        createWorkItem
      }
    );

    expect(createCustomer).toHaveBeenCalledWith({
      name: "Nova Conta",
      tradeName: "Nova Conta",
      email: "ana@example.com",
      phone: "11988887777",
      status: "prospect",
      notes: "Prioridade alta"
    });
    expect(createWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      typeSlug: "commercial",
      stateSlug: "new",
      title: "Nova Conta",
      description: "Prioridade alta",
      fields: expect.objectContaining({
        customerId: "customer-created",
        companyName: "Nova Conta",
        estimatedValue: 1500,
        paymentTerms: "50/50"
      }),
      customFieldValues: {
        "def-customer": "customer-created",
        "def-company": "Nova Conta",
        "def-value": 1500
      }
    }));
    expect(result.customer?.id).toBe("customer-created");
  });

  it("reuses an existing Customer and creates Signal as WorkItem without legacy payload", async () => {
    const createCustomer = vi.fn();
    const createWorkItem = vi.fn().mockResolvedValue({ id: "signal-1" });

    await submitCommercialWorkItem(
      { ...baseForm, contactEmail: "comercial@acme.com", companyName: "" },
      {
        kind: "signal",
        commercialTypeId: "commercial",
        signalTypeId: "signal",
        initialStatusId: "new",
        signalInitialStatusId: "captured",
        fieldDefinitions,
        catalogItemsById: new Map([[catalogItem.id, catalogItem]])
      },
      {
        customers: [existingCustomer],
        createCustomer,
        createWorkItem
      }
    );

    expect(createCustomer).not.toHaveBeenCalled();
    expect(createWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      typeSlug: "signal",
      stateSlug: "captured",
      fields: expect.objectContaining({
        customerId: "customer-existing",
        clientName: "Acme Ltda"
      })
    }));
  });
});
