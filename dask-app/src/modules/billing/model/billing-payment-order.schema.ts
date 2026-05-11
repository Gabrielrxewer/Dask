import { z } from "zod";

export const billingPaymentOrderFilterSchema = z.object({
  status: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  search: z.string().trim().max(120).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().trim().optional().nullable()
});

export type BillingPaymentOrderFilterValues = z.infer<typeof billingPaymentOrderFilterSchema>;
