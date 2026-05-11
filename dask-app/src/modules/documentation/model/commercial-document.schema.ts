import { z } from "zod";
import { commercialDocumentStatusSchema } from "@/modules/documentation/model/documentation-metadata.schema";

export const commercialDocumentSendSchema = z.object({
  recipients: z.array(z.string().email()).min(1).max(20),
  subject: z.string().min(1).max(180).optional(),
  message: z.string().max(4000).optional(),
  includeAttachments: z.boolean().default(true),
  selectedAssetIds: z.array(z.string().min(1)).default([]),
  expirationDate: z.string().nullable().optional(),
  requireLogin: z.boolean().default(true),
  allowAcceptReject: z.boolean().default(true),
  linkedWorkItemId: z.string().nullable().optional(),
  resolvedPreviewSnapshot: z.string().optional()
});

export const commercialDocumentDecisionSchema = z.object({
  documentId: z.string().min(1),
  workspaceId: z.string().min(1),
  customerId: z.string().nullable().optional(),
  clientUserId: z.string().nullable().optional(),
  decision: z.enum(["accepted", "rejected"]),
  reason: z.string().max(2000).nullable().optional(),
  decidedAt: z.string(),
  decidedBy: z.string().min(1),
  source: z.enum(["internal", "public"]),
  version: z.string().nullable().optional(),
  contentHash: z.string().nullable().optional(),
  status: commercialDocumentStatusSchema.optional()
});

export type CommercialDocumentSendInput = z.infer<typeof commercialDocumentSendSchema>;
export type CommercialDocumentDecision = z.infer<typeof commercialDocumentDecisionSchema>;
