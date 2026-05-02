import type { Customer } from "@/modules/workspace/model/types";

type CustomerDetailField = "document" | "email" | "phone";

export function getCustomerDisplayName(customer: Customer | null | undefined): string {
  return customer?.tradeName || customer?.legalName || customer?.name || "";
}

export function formatCustomerOptionDetail(
  customer: Customer,
  fields: CustomerDetailField[] = ["document", "email", "phone"]
): string {
  return fields.map((field) => customer[field]).filter(Boolean).join(" - ");
}
