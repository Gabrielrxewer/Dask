import { describe, expect, it } from "vitest";
import {
  fiscalCompanySchema,
  normalizeFiscalStripePolicy
} from "./fiscal-company.schema";
import { fiscalWizardSchema } from "./fiscal-wizard.schema";

describe("fiscalWizardSchema", () => {
  it("accepts the minimal wizard payload used to create an emission draft", () => {
    const result = fiscalWizardSchema.safeParse({
      documentType: "NFSE",
      companyConfigId: "company-1",
      customerId: "customer-1",
      customerName: "Cliente Dask",
      customerDocument: "12345678000190",
      itemName: "Servico mensal",
      quantity: "1",
      unitPrice: "250.00",
      discount: "0",
      reference: "NF-001",
      notes: ""
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing company, customer and invalid money fields", () => {
    const result = fiscalWizardSchema.safeParse({
      documentType: "NFE",
      companyConfigId: "",
      customerId: "",
      customerName: "",
      customerDocument: "",
      itemName: "",
      quantity: "1.12345",
      unitPrice: "valor",
      discount: "0",
      reference: "",
      notes: ""
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["companyConfigId", "customerId", "customerDocument", "itemName", "quantity", "unitPrice", "reference"])
      );
    }
  });
});

describe("fiscalCompanySchema", () => {
  it("normalizes CNPJ digits and keeps Focus config typed", () => {
    const result = fiscalCompanySchema.parse({
      displayName: "Dask",
      legalName: "Dask Tecnologia Ltda",
      cnpj: "12.345.678/0001-90",
      focusToken: "focus-token-123",
      focusEnvironment: "homologacao",
      emitAutomatically: false,
      stripePolicy: "manual_review"
    });

    expect(result.cnpj).toBe("12345678000190");
    expect(result.focusEnvironment).toBe("homologacao");
  });

  it("keeps the safe manual policy as the default", () => {
    const result = fiscalCompanySchema.parse({
      displayName: "Dask",
      legalName: "Dask Tecnologia Ltda",
      cnpj: "12345678000190",
      focusToken: "focus-token-123",
      focusEnvironment: "homologacao"
    });

    expect(result.emitAutomatically).toBe(false);
    expect(result.stripePolicy).toBe("manual_review");
  });

  it("rejects unknown Stripe policy values", () => {
    const result = fiscalCompanySchema.safeParse({
      displayName: "Dask",
      legalName: "Dask Tecnologia Ltda",
      cnpj: "12345678000190",
      focusToken: "focus-token-123",
      focusEnvironment: "homologacao",
      stripePolicy: "assisted_one_click"
    });

    expect(result.success).toBe(false);
  });

  it("normalizes legacy automatic policy state from company data", () => {
    expect(normalizeFiscalStripePolicy("automatic_after_payment", false)).toBe("automatic_after_payment");
    expect(normalizeFiscalStripePolicy("assisted_one_click", true)).toBe("automatic_after_payment");
    expect(normalizeFiscalStripePolicy("assisted_one_click", false)).toBe("manual_review");
  });
});
