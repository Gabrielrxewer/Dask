import { describe, expect, it } from "vitest";
import { leadFormSchema, signalFormSchema } from "@/modules/leads/model";

const baseLeadForm = {
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

describe("lead and signal forms", () => {
  it("accepts a valid lead payload with decimal value normalization rules", () => {
    const parsed = leadFormSchema.parse(baseLeadForm);

    expect(parsed).toMatchObject({
      contactName: "Ana Cliente",
      contactEmail: "ana@example.com",
      estimatedValue: "1200,50"
    });
  });

  it("uses the same required creation guard for signals", () => {
    expect(signalFormSchema.parse({ ...baseLeadForm, contactName: "", interest: "catalog-1" }).interest).toBe("catalog-1");
    expect(() =>
      signalFormSchema.parse({
        ...baseLeadForm,
        customerId: "",
        contactName: "",
        companyName: "",
        interest: ""
      })
    ).toThrow("Informe cliente, empresa, contato ou interesse para criar o lead.");
  });
});
