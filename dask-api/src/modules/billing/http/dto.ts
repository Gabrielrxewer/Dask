import { z } from 'zod';

export const createCheckoutSessionDto = z.object({
  planCode: z.enum(['PERSONAL', 'BUSINESS'])
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionDto>;

const currencySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{3}$/, 'Currency must be a 3-letter ISO code');

const requiredCatalogCommercialMetadataFields = [
  'unit',
  'defaultQuantity',
  'scope',
  'deliverables',
  'deliveryTerms',
  'paymentTerms',
  'proposalValidity',
  'contractTerm',
  'cancellationTerms',
  'clientResponsibilities',
  'acceptanceCriteria'
] as const;

export const connectWorkspaceParamsDto = z.object({
  workspaceId: z.string().uuid()
});

export const connectPaymentOrderParamsDto = z.object({
  workspaceId: z.string().uuid(),
  orderId: z.string().uuid()
});

export const connectCatalogItemParamsDto = z.object({
  workspaceId: z.string().uuid(),
  itemId: z.string().uuid()
});

const cursorPaginationDto = z.object({
  cursor: z.string().uuid().optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

const connectPaymentOrderStatusDto = z.enum([
  'DRAFT',
  'CHECKOUT_OPEN',
  'CHECKOUT_COMPLETED',
  'PENDING',
  'OVERDUE',
  'PAID',
  'FAILED',
  'CANCELED',
  'REFUNDED',
  'SUBSCRIPTION_ACTIVE',
  'SUBSCRIPTION_CANCELED'
]);

export const listConnectPaymentOrdersQueryDto = z.object({
  status: connectPaymentOrderStatusDto.optional(),
  customerId: z.string().uuid().optional(),
  email: z.string().trim().max(160).optional(),
  search: z.string().trim().max(120).optional()
}).merge(cursorPaginationDto);

export const syncConnectPaymentOrderQueryDto = z.object({
  sessionId: z.string().trim().min(1)
});

export const createConnectOnboardingLinkDto = z.object({
  refreshUrl: z.string().url().optional(),
  returnUrl: z.string().url().optional()
});

export const requestConnectPaymentCapabilityDto = z.object({
  paymentMethod: z.enum(['pix', 'boleto']).optional(),
  capability: z.enum(['pix_payments', 'boleto_payments']).optional()
}).transform((payload) => ({
  paymentMethod:
    payload.paymentMethod ??
    (payload.capability === 'pix_payments'
      ? 'pix'
      : payload.capability === 'boleto_payments'
        ? 'boleto'
        : undefined)
})).refine((payload): payload is { paymentMethod: 'pix' | 'boleto' } => Boolean(payload.paymentMethod), {
  message: 'paymentMethod is required'
});

export const billingPortalTokenScopeDto = z.enum([
  'view',
  'pay',
  'download_receipt',
  'download_fiscal_document'
]);

export const createBillingPortalTokenDto = z.object({
  expiresInSeconds: z.number().int().min(60).max(30 * 24 * 60 * 60).optional(),
  scopes: z.array(billingPortalTokenScopeDto).min(1).optional()
});

export const createConnectCheckoutSessionDto = z.object({
  amount: z.number().int().positive().optional(),
  currency: currencySchema.default('brl'),
  description: z.string().trim().min(3).max(120).optional(),
  catalogItemId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().trim().min(2).max(120).optional(),
  sendEmail: z.boolean().optional(),
  applicationFeeAmount: z.number().int().nonnegative().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  sourceWorkItemId: z.string().uuid().optional(),
  hasProposalOrContract: z.boolean().optional(),
  justification: z.string().trim().max(2000).optional(),
  metadata: z.record(z.string(), z.string().max(2000)).default({})
}).superRefine((payload, ctx) => {
  if (payload.catalogItemId) {
    return;
  }

  if (!payload.amount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['amount'],
      message: 'amount is required when catalogItemId is not provided'
    });
  }
  if (!payload.description) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['description'],
      message: 'description is required when catalogItemId is not provided'
    });
  }
});

export const createConnectCatalogItemDto = z.object({
  kind: z.enum(['PRODUCT', 'SERVICE']),
  billingType: z.enum(['ONE_TIME', 'ASSINATURA', 'SUBSCRIPTION']).default('ONE_TIME'),
  recurringInterval: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']).optional(),
  recurringIntervalCount: z.number().int().min(1).max(36).optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(3).max(280).optional(),
  amount: z.number().int().positive(),
  currency: currencySchema.default('brl'),
  metadata: z.record(z.string(), z.string().trim().max(2000)).default({})
}).superRefine((payload, ctx) => {
  if (!payload.description) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['description'],
      message: 'description is required for catalog items'
    });
  }

  for (const field of requiredCatalogCommercialMetadataFields) {
    const minimumLength = field === 'unit' || field === 'defaultQuantity' ? 1 : 3;
    if (!payload.metadata[field] || payload.metadata[field].trim().length < minimumLength) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metadata', field],
        message: `${field} is required for catalog items`
      });
    }
  }

  if (payload.billingType === 'ASSINATURA' || payload.billingType === 'SUBSCRIPTION') {
    if (!payload.recurringInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurringInterval'],
        message: 'recurringInterval is required for recurring items'
      });
    }
    return;
  }

  if (payload.recurringInterval || payload.recurringIntervalCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['billingType'],
      message: 'recurring fields are only allowed for recurring items'
    });
  }
});

export const updateConnectCatalogItemDto = createConnectCatalogItemDto;

export const listConnectCatalogItemsQueryDto = z.object({
  includeInactive: z
    .union([z.boolean(), z.string().trim().toLowerCase().transform((value) => value === 'true')])
    .optional()
    .default(true),
  kind: z.enum(['PRODUCT', 'SERVICE']).optional(),
  billingType: z.enum(['ONE_TIME', 'ASSINATURA', 'SUBSCRIPTION']).optional(),
  status: z.enum(['active', 'inactive', 'all']).optional(),
  search: z.string().trim().max(120).optional()
}).merge(cursorPaginationDto);

export type ConnectWorkspaceParamsInput = z.infer<typeof connectWorkspaceParamsDto>;
export type ConnectPaymentOrderParamsInput = z.infer<typeof connectPaymentOrderParamsDto>;
export type ConnectCatalogItemParamsInput = z.infer<typeof connectCatalogItemParamsDto>;
export type ListConnectPaymentOrdersQueryInput = z.infer<typeof listConnectPaymentOrdersQueryDto>;
export type SyncConnectPaymentOrderQueryInput = z.infer<typeof syncConnectPaymentOrderQueryDto>;
export type CreateConnectOnboardingLinkInput = z.infer<typeof createConnectOnboardingLinkDto>;
export type RequestConnectPaymentCapabilityInput = z.infer<typeof requestConnectPaymentCapabilityDto>;
export type CreateBillingPortalTokenInput = z.infer<typeof createBillingPortalTokenDto>;
export type CreateConnectCheckoutSessionInput = z.infer<typeof createConnectCheckoutSessionDto>;
export type CreateConnectCatalogItemInput = z.infer<typeof createConnectCatalogItemDto>;
export type UpdateConnectCatalogItemInput = z.infer<typeof updateConnectCatalogItemDto>;
export type ListConnectCatalogItemsQueryInput = z.infer<typeof listConnectCatalogItemsQueryDto>;
