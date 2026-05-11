import { z } from "zod";

export const linkCustomerSchema = z.object({
  customerId: z.string().trim()
});

export type LinkCustomerValues = z.infer<typeof linkCustomerSchema>;
