import { describe, expect, it } from "vitest";
import { billingCheckoutFormSchema } from "./billing-checkout.schema";

const validCustomer = {
  customerId: "customer-1",
  customerEmail: "cliente@example.com",
  customerDocument: "12.345.678/0001-90",
  sendEmail: true
};

describe("billingCheckoutFormSchema", () => {
  it("accepts catalog checkout with a selected item and fiscal customer", () => {
    const result = billingCheckoutFormSchema.safeParse({
      ...validCustomer,
      chargeSource: "catalog",
      catalogItemId: "catalog-1"
    });

    expect(result.success).toBe(true);
  });

  it("requires amount and description for manual charges", () => {
    const result = billingCheckoutFormSchema.safeParse({
      ...validCustomer,
      chargeSource: "manual",
      amount: "abc",
      description: ""
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(["amount", "description"]));
    }
  });

  it("blocks checkout when the customer has no CPF or CNPJ", () => {
    const result = billingCheckoutFormSchema.safeParse({
      ...validCustomer,
      customerDocument: "123",
      chargeSource: "catalog",
      catalogItemId: "catalog-1"
    });

    expect(result.success).toBe(false);
  });
});
