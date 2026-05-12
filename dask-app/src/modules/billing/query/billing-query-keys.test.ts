import { describe, expect, it } from "vitest";
import {
  billingQueryKeys,
  normalizeBillingCatalogFilters,
  normalizeBillingPaymentOrderFilters
} from "@/modules/billing/query/billing-query-keys";

describe("billingQueryKeys", () => {
  it("normalizes wide catalog pagination filters without keeping inactive all-state noise", () => {
    expect(normalizeBillingCatalogFilters({
      includeInactive: true,
      search: "  consultoria  ",
      kind: "SERVICE",
      status: "all",
      pageSize: 200,
      cursor: null
    })).toEqual({
      includeInactive: true,
      search: "consultoria",
      kind: "SERVICE",
      pageSize: 200
    });

    expect(billingQueryKeys.catalog("workspace-1", {
      search: "consultoria",
      pageSize: 200,
      cursor: "catalog-cursor"
    })).toEqual([
      "billing",
      "workspace",
      "workspace-1",
      "catalog",
      {
        search: "consultoria",
        pageSize: 200,
        cursor: "catalog-cursor"
      }
    ]);
  });

  it("segments payment history pages by cursor and operational filters", () => {
    expect(normalizeBillingPaymentOrderFilters({
      status: "PAID",
      email: "  cliente@example.com  ",
      amountMin: 0,
      amountMax: 100000,
      pageSize: 200,
      cursor: "orders-cursor"
    })).toEqual({
      status: "PAID",
      email: "cliente@example.com",
      amountMin: 0,
      amountMax: 100000,
      pageSize: 200,
      cursor: "orders-cursor"
    });

    expect(billingQueryKeys.history("workspace-1", { status: "PAID", pageSize: 200 }))
      .not.toEqual(billingQueryKeys.history("workspace-1", { status: "FAILED", pageSize: 200 }));
  });
});
