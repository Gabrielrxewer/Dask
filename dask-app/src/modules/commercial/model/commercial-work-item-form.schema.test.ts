import { describe, expect, it } from "vitest";
import { commercialWorkItemFormSchema, customerFormSchema, signalFormSchema } from "@/modules/commercial/model";

const baseWorkItemForm = {
  customerId: "",
  contactName: "Ana Cliente",
  contactEmail: "ana@example.com",
  contactPhone: "",
  companyName: "",
  source: "Inbound",
  interest: "",
  estimatedValue: "1200,50",
  proposalValidity: "",
  notes: ""
};

describe("commercial work item and signal forms", () => {
  it("accepts a valid WorkItem payload with decimal value normalization rules", () => {
    const parsed = commercialWorkItemFormSchema.parse(baseWorkItemForm);

    expect(parsed).toMatchObject({
      contactName: "Ana Cliente",
      contactEmail: "ana@example.com",
      estimatedValue: "1200,50"
    });
  });

  it("uses the same required creation guard for signals", () => {
    expect(signalFormSchema.parse({ ...baseWorkItemForm, contactName: "", interest: "catalog-1" }).interest).toBe("catalog-1");
    expect(() =>
      signalFormSchema.parse({
        ...baseWorkItemForm,
        customerId: "",
        contactName: "",
        companyName: "",
        interest: ""
      })
    ).toThrow("Informe cliente, empresa, contato ou interesse para criar o WorkItem comercial.");
  });

  it("validates and trims customer form values with optional blank contact fields", () => {
    const parsed = customerFormSchema.parse({
      name: "  Acme Ltda  ",
      tradeName: "",
      legalName: null,
      document: "",
      stateRegistration: "",
      municipalRegistration: "",
      taxRegime: "",
      email: "  comercial@acme.com  ",
      phone: "",
      website: "",
      logoUrl: "",
      status: "prospect",
      notes: "",
      address: {
        street: "  Rua Central  ",
        city: "",
        state: ""
      },
      sourceWorkItemId: ""
    });

    expect(parsed).toMatchObject({
      name: "Acme Ltda",
      email: "comercial@acme.com",
      address: {
        street: "Rua Central"
      }
    });
    expect(() => customerFormSchema.parse({ ...parsed, email: "email-invalido" })).toThrow("E-mail invalido");
  });
});
